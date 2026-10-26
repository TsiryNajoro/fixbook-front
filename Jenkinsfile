pipeline {
    agent any

    environment {
        IMAGE_NAME = "ghcr.io/tsirynajoro/fixbook-front"
        VITE_API_URL = ""
    }

    stages {

        stage('Gitleaks Current') {
            steps {
                sh '''
                    docker run --rm \
                        -v jenkins_home:/var/jenkins_home:ro \
                        zricethezav/gitleaks:latest \
                        detect \
                        --source="$WORKSPACE" \
                        --no-git \
                        --no-banner
                '''
            }
        }

        stage('Gitleaks History') {
            steps {
                sh '''
                    docker run --rm \
                        -v jenkins_home:/var/jenkins_home \
                        zricethezav/gitleaks:latest \
                        git "$WORKSPACE" \
                        --no-banner
                '''
            }
        }

        stage('SonarQube Analysis') {
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
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'ghcr-token',
                        usernameVariable: 'GH_USER',
                        passwordVariable: 'GH_TOKEN'
                    )
                ]) {
                    script {
                        def output = sh(
                            returnStdout: true,
                            script: '''
                                docker run --rm \
                                    -e GH_TOKEN="$GH_TOKEN" \
                                    -e GH_USER="$GH_USER" \
                                    -e GIT_COMMIT="$GIT_COMMIT" \
                                    -v jenkins_home:/var/jenkins_home \
                                    -w "$WORKSPACE" \
                                    node:24-alpine \
                                    sh -ec '
                                        apk add --no-cache git
                                        git checkout -B main "$GIT_COMMIT"
                                        npm ci

                                        AUTH=$(printf "%s:%s" \
                                            "$GH_USER" "$GH_TOKEN" \
                                            | base64 | tr -d "\\n")

                                        git config --local \
                                            http.https://github.com/.extraheader \
                                            "AUTHORIZATION: basic $AUTH"

                                        trap "git config --local --unset-all http.https://github.com/.extraheader || true" EXIT

                                        npx semantic-release --dry-run
                                    '
                            '''
                        ).trim()

                        echo output

                        def match = (
                            output =~ /The next release version is ([0-9]+\\.[0-9]+\\.[0-9]+)/
                        )

                        if (match.find()) {
                            env.RELEASE_VERSION = "v${match.group(1)}"
                            echo "Version retenue : ${env.RELEASE_VERSION}"
                        } else {
                            env.RELEASE_VERSION = ''
                            echo 'Aucune nouvelle version à publier.'
                        }
                    }
                }
            }
        }

        stage('Build Docker Image') {
            when {
                expression {
                    return env.RELEASE_VERSION?.trim()
                }
            }

            steps {
                sh '''
                    docker build \
                        -t ${IMAGE_NAME}:${RELEASE_VERSION} \
                        --build-arg VITE_API_URL="${VITE_API_URL}" \
                        .
                '''
            }
        }

        stage('Trivy Scan') {
            when {
                expression {
                    return env.RELEASE_VERSION?.trim()
                }
            }

            steps {
                sh '''
                    docker run --rm \
                        -v trivy-cache:/root/.cache/trivy \
                        -v /var/run/docker.sock:/var/run/docker.sock \
                        aquasec/trivy:latest \
                        image \
                        --severity HIGH,CRITICAL \
                        --exit-code 1 \
                        ${IMAGE_NAME}:${RELEASE_VERSION}
                '''
            }
        }

        stage('Publish Docker Image') {
            when {
                expression {
                    return env.RELEASE_VERSION?.trim()
                }
            }

            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'ghcr-token',
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
            when {
                expression {
                    return env.RELEASE_VERSION?.trim()
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
                        credentialsId: 'ghcr-token',
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
                            ghcr.io/sigstore/cosign/cosign:v3.0.2 \
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
            when {
                expression {
                    return env.RELEASE_VERSION?.trim()
                }
            }

            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'github-token',
                        usernameVariable: 'GH_USER',
                        passwordVariable: 'GH_TOKEN'
                    )
                ]) {
                    sh '''
                        docker run --rm \
                            -e GH_TOKEN="$GH_TOKEN" \
                            -e GH_USER="$GH_USER" \
                            -e GIT_COMMIT="$GIT_COMMIT" \
                            -v jenkins_home:/var/jenkins_home \
                            -w "$WORKSPACE" \
                            node:24-alpine \
                            sh -ec '
                                apk add --no-cache git
                                git checkout -B main "$GIT_COMMIT"
                                npm ci

                                AUTH=$(printf "%s:%s" \
                                    "$GH_USER" "$GH_TOKEN" \
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
    }
}