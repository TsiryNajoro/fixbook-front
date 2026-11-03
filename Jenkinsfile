pipeline {
    agent any

    options {
        disableConcurrentBuilds()
        timeout(time: 30, unit: 'MINUTES')
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

        GITOPS_REPO_URL = "https://github.com/tsirynajoro/fixbook-gitops.git"
        GITOPS_APP_FILE = "frontend/kustomization.yaml"
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
                    waitForQualityGate abortPipeline: true
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
                                        apk add --no-cache git
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
                            -e GH_TOKEN \
                            -e GIT_COMMIT="$GIT_COMMIT" \
                            -v jenkins_home:/var/jenkins_home \
                            -w "$WORKSPACE" \
                            ${NODE_IMAGE} \
                            sh -ec '
                                apk add --no-cache git
                                git checkout -B main "$GIT_COMMIT"
                                npm ci

                                AUTH=$(printf "x-access-token:%s" "$GH_TOKEN" \
                                    | base64 | tr -d "\\n")

                                git config --local \
                                    http.https://github.com/.extraheader \
                                    "AUTHORIZATION: basic $AUTH"

                                trap "git config --local --unset-all http.https://github.com/.extraheader || true" EXIT

                                npx semantic-release
                            '
                    '''
                }
            }
        }

        stage('Update GitOps Repo') {
            options { timeout(time: 5, unit: 'MINUTES') }

            when {
                expression {
                    return env.RELEASE_VERSION?.trim() && env.RELEASE_VERSION != 'dryrun' && !params.DRY_RUN
                }
            }

            steps {
                withCredentials([
                    string(
                        credentialsId: 'gitops-update-token',
                        variable: 'GITOPS_TOKEN'
                    )
                ]) {
                    sh '''
                        set +x

                        rm -rf gitops-repo

                        AUTH=$(printf "x-access-token:%s" "$GITOPS_TOKEN" \
                            | base64 | tr -d "\\n")

                        # Config git via variables d'environnement :
                        # rien n'est ecrit sur disque ni visible dans les arguments
                        export GIT_CONFIG_COUNT=1
                        export GIT_CONFIG_KEY_0="http.extraheader"
                        export GIT_CONFIG_VALUE_0="AUTHORIZATION: basic $AUTH"

                        git clone --depth 1 "${GITOPS_REPO_URL}" gitops-repo
                        cd gitops-repo

                        sed -i "s|newTag: .*|newTag: ${RELEASE_VERSION}|" "${GITOPS_APP_FILE}"

                        git config user.name  "jenkins-ci"
                        git config user.email "jenkins-ci@users.noreply.github.com"

                        git add "${GITOPS_APP_FILE}"

                        if git diff --cached --quiet; then
                            echo "Aucun changement dans le repo GitOps."
                        else
                            git commit -m "chore(fixbook-front): deploy ${RELEASE_VERSION}"
                            git push origin HEAD:main
                        fi
                    '''
                }
            }
        }
    }

    post {
        always {
            archiveArtifacts artifacts: 'reports/*.json', allowEmptyArchive: true
        }
        cleanup {
            sh 'rm -rf gitops-repo || true'
        }
    }
}