pipeline {
    agent any

    environment {
        IMAGE_NAME = "ghcr.io/tsirynajoro/fixbook-front"
        VITE_API_URL = "" //edit for real address  
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
                        sh "${scannerHome}/bin/sonar-scanner"
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

        stage('Build Docker Image') {
            steps {
                sh '''
                docker build \
                -t ${IMAGE_NAME}:${BUILD_NUMBER} \
                -t ${IMAGE_NAME}:1.0.${BUILD_NUMBER} \
                --build-arg VITE_API_URL=${VITE_API_URL} \
                .
                '''
            }
        }

        stage('Trivy Scan') {
            steps {
                sh '''
                docker run --rm \
                -v trivy-cache:/root/.cache/trivy \
                -v /var/run/docker.sock:/var/run/docker.sock \
                aquasec/trivy:latest \
                image \
                --severity HIGH,CRITICAL \
                --exit-code 1 \
                ${IMAGE_NAME}:${BUILD_NUMBER}
                '''
            }
        }

        stage('Publish Docker Image') {
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'ghcr-token',
                        usernameVariable: 'GH_USER',
                        passwordVariable: 'GH_TOKEN'
                    )
                ]) {
                    sh '''
                    echo $GH_TOKEN | docker login ghcr.io -u $GH_USER --password-stdin

                    docker push ${IMAGE_NAME}:${BUILD_NUMBER}
                    docker push ${IMAGE_NAME}:1.0.${BUILD_NUMBER}

                    docker logout ghcr.io
                    '''
                }
            }
        }

        stage('Cosign Sign') {
            steps {
                withCredentials([
                    file(credentialsId: 'cosign-key', variable: 'COSIGN_KEY'),
                    string(credentialsId: 'cosign-password', variable: 'COSIGN_PASSWORD'),
                    usernamePassword(
                        credentialsId: 'ghcr-token',
                        usernameVariable: 'GH_USER',
                        passwordVariable: 'GH_TOKEN'
                    )
                ]) {
                    sh '''
                    DIGEST=$(docker inspect --format='{{index .RepoDigests 0}}' ${IMAGE_NAME}:${BUILD_NUMBER} | cut -d@ -f2)

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

    }
}