// Qui a declenche le build (utilisateur, SCM, etc.) : sert a tracer chaque modification de GitOps.
def triggeredBy() {
    def causes = currentBuild.getBuildCauses()
    return causes ? causes.collect { it.shortDescription ?: 'inconnu' }.join(', ') : 'inconnu'
}

// Mail recapitulatif de chaque build (succes ou echec). Necessite le SMTP configure dans Jenkins.
// emailext (plugin Email Extension) permet la piece jointe ; sinon repli sur le mail simple, sans piece jointe.
// Un echec d'envoi ne fait jamais echouer le build.
def notifyBuild(String subject, String body, boolean attachReports) {
    if (!env.NOTIFY_EMAIL?.trim() || env.NOTIFY_EMAIL.contains('example.com')) {
        echo 'NOTIFY_EMAIL non configure : aucun mail envoye.'
        return
    }
    try {
        emailext to: env.NOTIFY_EMAIL, subject: subject, body: body,
                 attachmentsPattern: attachReports ? 'reports/*.json' : ''
    } catch (e) {
        echo "emailext indisponible (${e.message}), essai avec le mail simple (sans piece jointe)."
        try {
            mail to: env.NOTIFY_EMAIL, subject: subject, body: body
        } catch (e2) {
            echo "Envoi du mail impossible : ${e2.message}"
        }
    }
}

pipeline {
    agent any

    options {
        // Un seul build a la fois : evite deux releases ou deux pushes GitOps concurrents
        disableConcurrentBuilds()
        // Filet de securite global : aucun build ne reste bloque indefiniment
        timeout(time: 30, unit: 'MINUTES')
        // Retention : 20 builds, 10 archives de rapports
        buildDiscarder(logRotator(numToKeepStr: '20', artifactNumToKeepStr: '10'))
    }

    parameters {
        booleanParam(
            name: 'DRY_RUN',
            defaultValue: false,
            description: 'Execute scans et build, mais ne publie rien : ni image, ni signature, ni release, ni mise a jour GitOps'
        )
        booleanParam(
            name: 'RECONCILE_GITOPS',
            defaultValue: false,
            description: 'Resolution manuelle d une derive : aligne GitOps sur la derniere release, sans recreer de release. Decision humaine, tracee dans le commit GitOps. Reserve aux personnes autorisees.'
        )
    }

    environment {
        IMAGE_NAME      = "ghcr.io/tsirynajoro/fixbook-front"
        VITE_API_URL    = ""

        GITLEAKS_IMAGE  = "zricethezav/gitleaks:v8.30.1"
        TRIVY_IMAGE     = "aquasec/trivy:0.74.0"
        COSIGN_IMAGE    = "ghcr.io/sigstore/cosign/cosign:v3.0.2"
        NODE_IMAGE      = "node:24-alpine"

        APP_REPO_URL    = "https://github.com/tsirynajoro/fixbook-front.git"
        // Depot GitOps heberge sur GitLab (proprietaire = compte bot). Remplacer CHANGE-ME par le namespace GitLab.
        GITOPS_REPO_URL = "https://gitlab.com/TsiryNajoro/fixbook-gitops.git"
        GITOPS_APP_FILE = "frontend/kustomization.yaml"

        // A REMPLACER : destinataire des alertes de derive GitOps
        NOTIFY_EMAIL    = "rakotonirinatsirynajoro@gmail.com"
    }

    stages {

        stage('Gitleaks Current') {
            options { timeout(time: 10, unit: 'MINUTES') }

            steps {
                // Le volume n'est plus en :ro car Gitleaks doit ecrire son rapport.
                // --redact : le rapport ne contient jamais les secrets en clair.
                sh '''
                    rm -rf reports
                    mkdir -p reports

                    docker run --rm \
                        -v jenkins_home:/var/jenkins_home \
                        ${GITLEAKS_IMAGE} \
                        detect \
                        --source="$WORKSPACE" \
                        --no-git \
                        --no-banner \
                        --redact \
                        --report-format json \
                        --report-path "$WORKSPACE/reports/gitleaks-current.json"
                '''
            }
        }

        stage('Gitleaks History') {
            options { timeout(time: 10, unit: 'MINUTES') }

            steps {
                sh '''
                    docker run --rm \
                        -v jenkins_home:/var/jenkins_home \
                        ${GITLEAKS_IMAGE} \
                        git "$WORKSPACE" \
                        --no-banner \
                        --redact \
                        --report-format json \
                        --report-path "$WORKSPACE/reports/gitleaks-history.json"
                '''
            }
        }

        stage('SonarQube Analysis') {
            options { timeout(time: 10, unit: 'MINUTES') }

            steps {
                withSonarQubeEnv('SonarQube') {
                    script {
                        def scannerHome = tool 'SonarScanner'

                        sh """
                            ${scannerHome}/bin/sonar-scanner
                        """
                    }
                }
            }
        }

        stage('SonarQube Quality Gate') {
            steps {
                timeout(time: 5, unit: 'MINUTES') {
                    script {
                        def qg = waitForQualityGate()
                        env.QG_STATUS = qg.status
                        if (qg.status != 'OK') {
                            error("SonarQube Quality Gate : ${qg.status}")
                        }
                    }
                }
            }
        }

        stage('Determine Release Version') {
            options { timeout(time: 10, unit: 'MINUTES') }

            steps {
                // Token 2 : acces au repo applicatif (tag + release)
                withCredentials([
                    string(
                        credentialsId: 'github-release-token',
                        variable: 'GH_TOKEN'
                    )
                ]) {
                    script {
                        def output = sh(
                            returnStdout: true,
                            script: '''
                                set +x

                                docker run --rm \
                                    -e GH_TOKEN \
                                    -e GIT_COMMIT="$GIT_COMMIT" \
                                    -v jenkins_home:/var/jenkins_home \
                                    -w "$WORKSPACE" \
                                    ${NODE_IMAGE} \
                                    sh -ec '
                                        for i in 1 2 3; do apk add --no-cache git && break; [ "$i" = 3 ] && exit 1; sleep 5; done
                                        git checkout -B main "$GIT_COMMIT"
                                        npm ci

                                        AUTH=$(printf "x-access-token:%s" "$GH_TOKEN" \
                                            | base64 | tr -d "\\n")

                                        git config --local \
                                            http.https://github.com/.extraheader \
                                            "AUTHORIZATION: basic $AUTH"

                                        trap "git config --local --unset-all http.https://github.com/.extraheader || true" EXIT

                                        npx semantic-release --dry-run 2>&1
                                    '
                            '''
                        ).trim()

                        echo output

                        def match = (output =~ /The next release version is (\d+\.\d+\.\d+)/)

                        if (match.find()) {
                            env.RELEASE_VERSION = "v${match.group(1)}"
                            env.DEPLOY_VERSION  = env.RELEASE_VERSION
                            echo "Version retenue : ${env.RELEASE_VERSION}"
                        } else if (output.contains('There are no relevant changes, so no new version is released.')) {
                            if (params.DRY_RUN) {
                                env.RELEASE_VERSION = 'dryrun'
                                echo 'DRY_RUN : aucune nouvelle version, tag local "dryrun" pour tester build et Trivy.'
                            } else {
                                env.RELEASE_VERSION = ''
                                echo 'Aucune nouvelle version à publier.'
                            }
                        } else {
                            error('Impossible de déterminer la version. Vérifier les logs Semantic Release.')
                        }
                    }
                }
            }
        }

        stage('Build Docker Image') {
            options { timeout(time: 15, unit: 'MINUTES') }

            when {
                expression {
                    return env.RELEASE_VERSION?.trim()
                }
            }

            steps {
                sh '''
                    docker build --pull --no-cache \
                        -t ${IMAGE_NAME}:${RELEASE_VERSION} \
                        --build-arg VITE_API_URL="${VITE_API_URL}" \
                        .
                '''
            }
        }

        stage('Trivy Scan') {
            options { timeout(time: 15, unit: 'MINUTES') }

            when {
                expression {
                    return env.RELEASE_VERSION?.trim()
                }
            }

            steps {
                // Deux passes : Trivy ne sait pas ecrire un JSON et bloquer le build
                // avec un affichage lisible en meme temps. Le cache rend la 2e rapide.
                sh '''
                    # 1) Rapport JSON complet (ne fait jamais echouer le build)
                    docker run --rm \
                        -v trivy-cache:/root/.cache/trivy \
                        -v /var/run/docker.sock:/var/run/docker.sock \
                        -v jenkins_home:/var/jenkins_home \
                        ${TRIVY_IMAGE} \
                        image \
                        --severity HIGH,CRITICAL \
                        --format json \
                        --output "$WORKSPACE/reports/trivy.json" \
                        --exit-code 0 \
                        ${IMAGE_NAME}:${RELEASE_VERSION}

                    # 2) Verification bloquante, lisible dans la console
                    docker run --rm \
                        -v trivy-cache:/root/.cache/trivy \
                        -v /var/run/docker.sock:/var/run/docker.sock \
                        ${TRIVY_IMAGE} \
                        image \
                        --severity HIGH,CRITICAL \
                        --exit-code 1 \
                        ${IMAGE_NAME}:${RELEASE_VERSION}
                '''
            }
        }

        stage('Publish Docker Image') {
            options { timeout(time: 10, unit: 'MINUTES') }

            when {
                expression {
                    return env.RELEASE_VERSION?.trim() && env.RELEASE_VERSION != 'dryrun' && !params.DRY_RUN
                }
            }

            steps {
                // Token 1 : GHCR uniquement (write:packages)
                withCredentials([
                    usernamePassword(
                        credentialsId: 'ghcr-push-token',
                        usernameVariable: 'GH_USER',
                        passwordVariable: 'GH_TOKEN'
                    )
                ]) {
                    sh '''
                        set +x

                        echo "$GH_TOKEN" | docker login ghcr.io \
                            -u "$GH_USER" \
                            --password-stdin

                        docker push ${IMAGE_NAME}:${RELEASE_VERSION}

                        docker logout ghcr.io
                    '''
                }
            }
        }

        stage('Cosign Sign') {
            options { timeout(time: 5, unit: 'MINUTES') }

            when {
                expression {
                    return env.RELEASE_VERSION?.trim() && env.RELEASE_VERSION != 'dryrun' && !params.DRY_RUN
                }
            }

            steps {
                withCredentials([
                    file(
                        credentialsId: 'cosign-key',
                        variable: 'COSIGN_KEY'
                    ),
                    string(
                        credentialsId: 'cosign-password',
                        variable: 'COSIGN_PASSWORD'
                    ),
                    // Token 1 : la signature est aussi poussee sur GHCR
                    usernamePassword(
                        credentialsId: 'ghcr-push-token',
                        usernameVariable: 'GH_USER',
                        passwordVariable: 'GH_TOKEN'
                    )
                ]) {
                    sh '''
                        set +x

                        DIGEST=$(docker inspect \
                            --format='{{index .RepoDigests 0}}' \
                            ${IMAGE_NAME}:${RELEASE_VERSION} \
                            | cut -d@ -f2)

                        test -n "$DIGEST"

                        COSIGN_KEY_CONTAINER="/jenkins_home${COSIGN_KEY#/var/jenkins_home}"

                        docker run --rm \
                            --user 0:0 \
                            -e COSIGN_PASSWORD \
                            -v jenkins_home:/jenkins_home:ro \
                            ${COSIGN_IMAGE} \
                            sign \
                            --key "$COSIGN_KEY_CONTAINER" \
                            --registry-username "$GH_USER" \
                            --registry-password "$GH_TOKEN" \
                            ${IMAGE_NAME}@${DIGEST}
                    '''
                }
            }
        }

        stage('Create Git Tag and GitHub Release') {
            options { timeout(time: 10, unit: 'MINUTES') }

            when {
                expression {
                    return env.RELEASE_VERSION?.trim() && env.RELEASE_VERSION != 'dryrun' && !params.DRY_RUN
                }
            }

            steps {
                // Token 2 : acces au repo applicatif (tag + release)
                withCredentials([
                    string(
                        credentialsId: 'github-release-token',
                        variable: 'GH_TOKEN'
                    )
                ]) {
                    sh '''
                        set +x

                        docker run --rm \
                            -e CI=true \
                            -e RELEASE_VERSION \
                            -e GH_TOKEN \
                            -e GIT_COMMIT="$GIT_COMMIT" \
                            -v jenkins_home:/var/jenkins_home \
                            -w "$WORKSPACE" \
                            ${NODE_IMAGE} \
                            sh -ec '
                                for i in 1 2 3; do apk add --no-cache git && break; [ "$i" = 3 ] && exit 1; sleep 5; done
                                git checkout -B main "$GIT_COMMIT"
                                npm ci

                                AUTH=$(printf "x-access-token:%s" "$GH_TOKEN" \
                                    | base64 | tr -d "\\n")

                                git config --local \
                                    http.https://github.com/.extraheader \
                                    "AUTHORIZATION: basic $AUTH"

                                trap "git config --local --unset-all http.https://github.com/.extraheader || true" EXIT

                                npx semantic-release

                                git ls-remote --tags origin "refs/tags/$RELEASE_VERSION" | grep -q "refs/tags/$RELEASE_VERSION" || { echo "ERREUR : le tag $RELEASE_VERSION est absent apres la release"; exit 1; }
                            '
                    '''
                }
            }
        }

        // Controle : GitOps doit contenir exactement la release PRECEDENTE.
        // Ce stage ne fait jamais echouer le build : il pose GITOPS_OK = true/false.
        // Si false, "Update GitOps Repo" est SKIPPED ; le mail recapitulatif de fin de build le signale.
        // Lecture seule, donc aussi execute en DRY_RUN.
        // Avec RECONCILE_GITOPS (decision humaine explicite) : pas de blocage, GitOps est aligne sur la
        // derniere release (ou sur la nouvelle si ce build en cree une), sans recreer de release.
        stage('Check GitOps') {
            options { timeout(time: 5, unit: 'MINUTES') }

            when {
                expression {
                    return (env.DEPLOY_VERSION?.trim() && env.DEPLOY_VERSION != 'dryrun') || params.RECONCILE_GITOPS
                }
            }

            steps {
                withCredentials([
                    string(credentialsId: 'github-release-token', variable: 'APP_TOKEN'),
                    string(credentialsId: 'gitops-update-token', variable: 'GITOPS_TOKEN')
                ]) {
                    script {
                        def status = sh(
                            returnStatus: true,
                            script: '''
                                    set +x
                                    rm -f gitops-check.out gitops-check.log gitops-check.tail

                                    ST=0
                                    (
                                        read_tag() { sed -n -E "s/^[[:space:]]*newTag:[[:space:]]*([^[:space:]]+).*/\\1/p"; }
                                        auth() { printf "x-access-token:%s" "$1" | base64 | tr -d "\\n"; }

                                        # lowSpeed : un reseau bloque fait echouer git en 30 s au lieu de pendre
                                        export GIT_CONFIG_COUNT=3
                                        export GIT_CONFIG_KEY_0="http.extraheader"
                                        export GIT_CONFIG_KEY_1="http.lowSpeedLimit"
                                        export GIT_CONFIG_VALUE_1="1000"
                                        export GIT_CONFIG_KEY_2="http.lowSpeedTime"
                                        export GIT_CONFIG_VALUE_2="30"

                                        # 1) release precedente = plus recent tag, hors celle de ce build
                                        export GIT_CONFIG_VALUE_0="AUTHORIZATION: basic $(auth "$APP_TOKEN")"
                                        TAGS=$(git ls-remote --tags --refs "${APP_REPO_URL}" "refs/tags/v*") \
                                            || { echo "ERREUR : lecture des tags impossible sur ${APP_REPO_URL}"; exit 1; }
                                        PREVIOUS=$(printf "%s\\n" "$TAGS" \
                                            | sed "s|.*refs/tags/||" \
                                            | grep -E "^v[0-9]+\\.[0-9]+\\.[0-9]+$" \
                                            | grep -vx "${RELEASE_VERSION:-none}" \
                                            | sort -V | tail -1 || true)
                                        [ -n "$PREVIOUS" ] || PREVIOUS=none

                                        # 2) version actuelle dans GitOps + dernier auteur de cette ligne
                                        # GitLab : project access token, le nom d'utilisateur est libre (non vide)
                                        export GIT_CONFIG_VALUE_0="AUTHORIZATION: basic $(printf "oauth2:%s" "$GITOPS_TOKEN" | base64 | tr -d "\\n")"
                                        rm -rf gitops-repo
                                        git clone -q "${GITOPS_REPO_URL}" gitops-repo
                                        COUNT=$(grep -Ec "^[[:space:]]*newTag:" "gitops-repo/${GITOPS_APP_FILE}" || true)
                                        [ "$COUNT" = "1" ] || { echo "ERREUR : ${COUNT} ligne(s) newTag: dans ${GITOPS_APP_FILE} (une seule attendue)"; exit 1; }
                                        CURRENT=$(read_tag < "gitops-repo/${GITOPS_APP_FILE}")
                                        LASTCHANGE=$(git -C gitops-repo log -1 --date=short --format="%an, %ad, %s" -- "${GITOPS_APP_FILE}" | tr -d "|\\n")

                                        echo "${PREVIOUS}|${CURRENT}|${LASTCHANGE}" > gitops-check.out
                                    ) > gitops-check.log 2>&1 || ST=$?

                                    cat gitops-check.log
                                    tail -n 15 gitops-check.log > gitops-check.tail
                                    exit $ST
                                                                                        '''
                        )

                        if (status != 0) {
                            env.GITOPS_OK = 'false'
                            env.GITOPS_RESULT = 'check-failed'
                            env.GITOPS_NOTE = "Controle GitOps impossible, GitOps non modifie. Derniers messages :\n${readFile('gitops-check.tail')}"
                            echo env.GITOPS_NOTE
                            return
                        }

                        def parts = readFile('gitops-check.out').trim().split('\\|', 3)
                        if (parts.size() != 3) {
                            env.GITOPS_OK = 'false'
                            env.GITOPS_RESULT = 'check-failed'
                            env.GITOPS_NOTE = 'Controle GitOps : resultat inattendu, GitOps non modifie.'
                            echo env.GITOPS_NOTE
                            return
                        }
                        def previous   = parts[0]
                        def current    = parts[1]
                        def lastChange = parts[2]

                        echo "Release precedente : ${previous} | GitOps : ${current} | derniere modif GitOps : ${lastChange}"

                        if (params.RECONCILE_GITOPS) {
                            // Sans nouvelle release dans ce build, "precedente" = derniere release existante
                            def target = (env.DEPLOY_VERSION?.trim() && env.DEPLOY_VERSION != 'dryrun') ? env.DEPLOY_VERSION : previous
                            if (target == 'none') {
                                env.GITOPS_OK = 'false'
                                env.GITOPS_RESULT = 'check-failed'
                                env.GITOPS_NOTE = 'Reconciliation impossible : aucune release trouvee.'
                                echo env.GITOPS_NOTE
                            } else if (params.DRY_RUN) {
                                echo "DRY_RUN : GitOps serait aligne de ${current} vers ${target}."
                            } else {
                                env.DEPLOY_VERSION = target
                                env.GITOPS_OK = 'true'
                                echo "Reconciliation : GitOps sera aligne de ${current} vers ${target}."
                            }
                            return
                        }

                        if (previous == 'none' || previous == current) {
                            env.GITOPS_OK = 'true'
                            env.GITOPS_RESULT = 'coherent'
                            echo 'GitOps coherent avec la release precedente : mise a jour autorisee.'
                        } else {
                            env.GITOPS_OK = 'false'
                            env.GITOPS_RESULT = 'drift'
                            env.GITOPS_NOTE = "Release precedente : ${previous}\n" +
                                              "Version dans GitOps : ${current}\n" +
                                              "Derniere modification de cette ligne : ${lastChange}\n" +
                                              "Pour aligner GitOps sur la derniere release : build avec RECONCILE_GITOPS."
                            echo env.GITOPS_NOTE
                        }
                    }
                }
            }
        }

        // Place en dernier : on ne demande un deploiement que si scan, signature et release ont reussi.
        // SKIPPED si le controle n'a pas donne son feu vert (fail-closed). Sert aussi a la reconciliation manuelle.
        // Un echec ici ne rend pas le build rouge : GitOps reste tel quel, le mail de fin de build le signale.
        stage('Update GitOps Repo') {
            options { timeout(time: 5, unit: 'MINUTES') }

            when {
                expression {
                    return env.DEPLOY_VERSION?.trim() && env.DEPLOY_VERSION != 'dryrun' && !params.DRY_RUN &&
                           env.GITOPS_OK == 'true'
                }
            }

            steps {
                script {
                    // Tracabilite : ces valeurs finissent dans le message du commit GitOps
                    env.TRIGGERED_BY = triggeredBy()
                    env.GITOPS_MODE  = params.RECONCILE_GITOPS ? 'reconcile' : 'deploy'
                }

                // Token 3 : repo GitOps uniquement
                withCredentials([
                    string(credentialsId: 'gitops-update-token', variable: 'GITOPS_TOKEN')
                ]) {
                    script {
                        def status = sh(
                            returnStatus: true,
                            script: '''
                                    set +x
                                    rm -f gitops-update.log gitops-update.tail

                                    ST=0
                                    (
                                        read_tag() { sed -n -E "s/^[[:space:]]*newTag:[[:space:]]*([^[:space:]]+).*/\\1/p"; }

                                        rm -rf gitops-repo

                                        # GitLab : project access token, le nom d'utilisateur est libre (non vide)
                                        AUTH=$(printf "oauth2:%s" "$GITOPS_TOKEN" \
                                            | base64 | tr -d "\\n")

                                        # Config git via variables d'environnement :
                                        # rien n'est ecrit sur disque ni visible dans les arguments
                                        export GIT_CONFIG_COUNT=3
                                        export GIT_CONFIG_KEY_0="http.extraheader"
                                        export GIT_CONFIG_VALUE_0="AUTHORIZATION: basic $AUTH"
                                        export GIT_CONFIG_KEY_1="http.lowSpeedLimit"
                                        export GIT_CONFIG_VALUE_1="1000"
                                        export GIT_CONFIG_KEY_2="http.lowSpeedTime"
                                        export GIT_CONFIG_VALUE_2="30"

                                        # 1) clone, 3 essais
                                        CLONED=0
                                        for attempt in 1 2 3; do
                                            if git clone -q "${GITOPS_REPO_URL}" gitops-repo; then CLONED=1; break; fi
                                            rm -rf gitops-repo
                                            if [ "$attempt" -lt 3 ]; then
                                                echo "Clone impossible (essai $attempt/3), nouvelle tentative dans 10 s..."
                                                sleep 10
                                            fi
                                        done
                                        [ "$CLONED" = "1" ] || { echo "ERREUR : clone du repo GitOps impossible apres 3 essais"; exit 1; }

                                        cd gitops-repo

                                        # 2) exactement une ligne newTag: attendue, sinon on s'arrete
                                        COUNT=$(grep -Ec "^[[:space:]]*newTag:" "${GITOPS_APP_FILE}" || true)
                                        [ "$COUNT" = "1" ] || { echo "ERREUR : ${COUNT} ligne(s) newTag: dans ${GITOPS_APP_FILE} (une seule attendue)"; exit 1; }

                                        # 3) remplacement puis verification exacte
                                        OLD_TAG=$(read_tag < "${GITOPS_APP_FILE}")
                                        sed -i -E "s|^([[:space:]]*)newTag:.*|\\1newTag: ${DEPLOY_VERSION}|" "${GITOPS_APP_FILE}"
                                        [ "$(read_tag < "${GITOPS_APP_FILE}")" = "${DEPLOY_VERSION}" ] || { echo "ERREUR : ${DEPLOY_VERSION} absent de ${GITOPS_APP_FILE} apres modification"; exit 1; }

                                        git config user.name  "jenkins-ci"
                                        git config user.email "jenkins-ci@users.noreply.gitlab.com"
                                        git add "${GITOPS_APP_FILE}"

                                        if git diff --cached --quiet; then
                                            echo "GitOps contient deja ${DEPLOY_VERSION}, rien a faire."
                                            exit 0
                                        fi

                                        git commit -q \
                                            -m "chore(fixbook-front): ${GITOPS_MODE} ${DEPLOY_VERSION}" \
                                            -m "Ancienne version : ${OLD_TAG}" \
                                            -m "Mode : ${GITOPS_MODE}" \
                                            -m "Declenche par : ${TRIGGERED_BY}" \
                                            -m "Build : ${BUILD_URL}"

                                        # 4) push, 3 essais avec resynchronisation (jamais de --force)
                                        PUSHED=0
                                        for attempt in 1 2 3; do
                                            if git push -q origin HEAD:main; then PUSHED=1; break; fi
                                            echo "Push refuse (essai $attempt/3) : resynchronisation puis nouvelle tentative..."
                                            git pull -q --rebase origin main || true
                                        done
                                        [ "$PUSHED" = "1" ] || { echo "ERREUR : push GitOps impossible apres 3 essais"; exit 1; }

                                        # 5) controle final sur le depot distant
                                        git fetch -q origin main
                                        [ "$(git show "origin/main:${GITOPS_APP_FILE}" | read_tag)" = "${DEPLOY_VERSION}" ] || { echo "ERREUR : le depot distant ne contient pas ${DEPLOY_VERSION}"; exit 1; }
                                        echo "GitOps mis a jour : ${DEPLOY_VERSION}"
                                    ) > gitops-update.log 2>&1 || ST=$?

                                    cat gitops-update.log
                                    tail -n 15 gitops-update.log > gitops-update.tail
                                    exit $ST
                                                                                        '''
                        )

                        if (status != 0) {
                            env.GITOPS_RESULT = 'update-failed'
                            env.GITOPS_NOTE = "Mise a jour GitOps echouee, GitOps non modifie. Derniers messages :\n${readFile('gitops-update.tail')}"
                            echo env.GITOPS_NOTE
                        } else {
                            env.GITOPS_RESULT = 'updated'
                        }
                    }
                }
            }
        }
    }

    post {
        always {
            // "always" : on veut les rapports surtout quand un scan fait echouer le build
            archiveArtifacts artifacts: 'reports/*.json', allowEmptyArchive: true

            // Mail recapitulatif a chaque build, succes ou echec
            script {
                def result = currentBuild.currentResult

                def vulns = sh(
                    returnStdout: true,
                    script: 'if [ -f reports/trivy.json ]; then grep -o "\\"VulnerabilityID\\"" reports/trivy.json | wc -l; else echo n/a; fi'
                ).trim()

                def gitops
                switch (env.GITOPS_RESULT ?: '') {
                    case 'updated':
                        gitops = "Mis à jour effectué (${env.DEPLOY_VERSION})"; break
                    case 'drift':
                        gitops = 'Drift de version trouvé : "Update GitOps Repo" SKIPPED, GitOps non modifié'; break
                    case 'check-failed':
                        gitops = 'Contrôle impossible : "Update GitOps Repo" SKIPPED, GitOps non modifié'; break
                    case 'update-failed':
                        gitops = 'Mise à jour ÉCHOUÉE, GitOps non modifié'; break
                    case 'coherent':
                        gitops = params.DRY_RUN ? 'Aucun drift (DRY_RUN : mise à jour non effectuée)' : 'Aucun drift'; break
                    default:
                        gitops = 'Aucun drift ni mise à jour (pas de nouvelle version)'
                }

                def version = !env.RELEASE_VERSION?.trim() ? 'aucune nouvelle version' :
                              (env.RELEASE_VERSION == 'dryrun' ? "aucune nouvelle version (image de test locale : tag 'dryrun')" : env.RELEASE_VERSION)

                def lines = []
                lines << "Statut : ${result}"
                lines << "Image : ${env.IMAGE_NAME}"
                lines << "Version : ${version}"
                if (params.DRY_RUN) { lines << 'Mode : DRY_RUN (rien n\'a été publié)' }
                if (params.RECONCILE_GITOPS) { lines << 'Mode : RECONCILE_GITOPS' }
                lines << "SonarQube Quality Gate : ${env.QG_STATUS ?: 'non exécuté'}"
                lines << "Trivy : ${vulns == 'n/a' ? 'non exécuté' : vulns + ' vulnérabilité(s) HIGH/CRITICAL'}"
                lines << "Repository GitOps : ${gitops}"
                if (env.GITOPS_NOTE?.trim()) { lines << "\n${env.GITOPS_NOTE}" }
                lines << "\nBuild : ${env.BUILD_URL}"

                def drift = (env.GITOPS_RESULT == 'drift') ? ' | drift GitOps' : ''
                def shortVersion = env.RELEASE_VERSION?.trim() ? env.RELEASE_VERSION : 'aucune version'
                def subject = "[Fixbook] ${env.IMAGE_NAME.tokenize('/').last()} ${shortVersion} : ${result}${drift}"

                // Rapports JSON joints seulement s'il y a eu un probleme (vulnerabilites ou echec)
                def attach = (result != 'SUCCESS') || (vulns != 'n/a' && vulns != '0')

                notifyBuild(subject, lines.join('\n'), attach)
            }
        }
        cleanup {
            sh 'rm -rf gitops-repo gitops-check.* gitops-update.* || true'
        }
    }
}