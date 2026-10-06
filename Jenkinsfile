pipeline {
    agent any

    environment {
        IMAGE_NAME = "ghcr.io/tsirynajoro/fixbook-front"
        VITE_API_URL = "http://localhost:5000" //edit for real address  
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
                docker build --no-cache -t ${IMAGE_NAME}:${BUILD_NUMBER} \
                  --build-arg VITE_API_URL=${VITE_API_URL} \
                  .
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

                    docker logout ghcr.io
                    '''
                }
            }
        }

    }
}