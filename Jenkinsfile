def triggeredBy() {
    def causes = currentBuild.getBuildCauses()
    return causes ? causes.collect { it.shortDescription ?: 'inconnu' }.join(', ') : 'inconnu'
}

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
    }

    environment {
        IMAGE_NAME      = "ghcr.io/tsirynajoro/fixbook-front"
        VITE_API_URL    = ""

        GITLEAKS_IMAGE  = "zricethezav/gitleaks:v8.30.1"
        TRIVY_IMAGE     = "aquasec/trivy:0.74.0"
        COSIGN_IMAGE    = "ghcr.io/sigstore/cosign/cosign:v3.0.2"
        NODE_IMAGE      = "node:24-alpine"

        APP_NAME        = "fixbook-front"
        APP_REPO_URL    = "https://github.com/tsirynajoro/fixbook-front.git"
        GITOPS_REPO_URL = "https://gitlab.com/na-group3445946/fixbook-gitops.git"
        GITOPS_APP_FILE = "frontend/kustomization.yaml"

        NOTIFY_EMAIL    = "rakotonirinatsirynajoro@gmail.com"
    }

    stages {

        stage('Gitleaks Current') {
            options { timeout(time: 10, unit: 'MINUTES') }

            steps {

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

        stage('Unit Tests') {
            options { timeout(time: 10, unit: 'MINUTES') }

            steps {
                sh 'sh scripts/test.sh unit'
            }
        }

        stage('Integration Tests') {
            options { timeout(time: 10, unit: 'MINUTES') }

            steps {
                // npm test runs the full suite and creates coverage/lcov.info for SonarQube.
                sh 'sh scripts/test.sh integration'
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
                withCredentials([
                    string(
                        credentialsId: 'github-release-token',
                        variable: 'GH_TOKEN'
                    )
                ]) {
                    script {
                        def output = sh(returnStdout: true, script: 'sh scripts/release.sh dry-run').trim()

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
                sh 'sh scripts/trivy-scan.sh'
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
                withCredentials([
                    usernamePassword(
                        credentialsId: 'ghcr-push-token',
                        usernameVariable: 'GH_USER',
                        passwordVariable: 'GH_TOKEN'
                    )
                ]) {
                    sh 'sh scripts/docker-publish.sh'
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
                    usernamePassword(
                        credentialsId: 'ghcr-push-token',
                        usernameVariable: 'GH_USER',
                        passwordVariable: 'GH_TOKEN'
                    )
                ]) {
                    sh 'sh scripts/cosign-sign.sh'
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
                withCredentials([
                    string(
                        credentialsId: 'github-release-token',
                        variable: 'GH_TOKEN'
                    )
                ]) {
                    sh 'sh scripts/release.sh publish'
                }
            }
        }

        stage('Check GitOps') {
            options { timeout(time: 5, unit: 'MINUTES') }

            when {
                expression {
                    return env.DEPLOY_VERSION?.trim() && env.DEPLOY_VERSION != 'dryrun'
                }
            }

            steps {
                withCredentials([
                    string(credentialsId: 'github-release-token', variable: 'APP_TOKEN'),
                    string(credentialsId: 'gitops-update-token', variable: 'GITOPS_TOKEN')
                ]) {
                    script {
                        def status = sh(returnStatus: true, script: 'sh scripts/gitops-check.sh')

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
                                              "Pour aligner GitOps sur la derniere release : lancer le job fixbook-gitops-reconcile."
                            echo env.GITOPS_NOTE
                        }
                    }
                }
            }
        }


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
                    env.TRIGGERED_BY = triggeredBy()
                    env.GITOPS_MODE  = 'deploy'
                }

                withCredentials([
                    string(credentialsId: 'gitops-update-token', variable: 'GITOPS_TOKEN')
                ]) {
                    script {
                        def status = sh(returnStatus: true, script: 'sh scripts/gitops-update.sh')

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
            archiveArtifacts artifacts: 'reports/*.json', allowEmptyArchive: true

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
                lines << "SonarQube Quality Gate : ${env.QG_STATUS ?: 'non exécuté'}"
                lines << "Trivy : ${vulns == 'n/a' ? 'non exécuté' : vulns + ' vulnérabilité(s) HIGH/CRITICAL'}"
                lines << "Repository GitOps : ${gitops}"
                if (env.GITOPS_NOTE?.trim()) { lines << "\n${env.GITOPS_NOTE}" }
                lines << "\nBuild : ${env.BUILD_URL}"

                def drift = (env.GITOPS_RESULT == 'drift') ? ' | drift GitOps' : ''
                def shortVersion = env.RELEASE_VERSION?.trim() ? env.RELEASE_VERSION : 'aucune version'
                def subject = "[Fixbook] ${env.IMAGE_NAME.tokenize('/').last()} ${shortVersion} : ${result}${drift}"

                def attach = (result != 'SUCCESS') || (vulns != 'n/a' && vulns != '0')

                notifyBuild(subject, lines.join('\n'), attach)
            }
        }
        cleanup {
            sh 'rm -rf gitops-repo gitops-check.* gitops-update.* || true'
        }
    }
}