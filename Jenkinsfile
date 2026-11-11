// Pipeline CI du frontend : à compléter (carte 25)

// Notification : toujours dans la console, et dans Slack si configuré
def notify(String color, String msg) {
  echo "NOTIFICATION : ${msg}"
  try {
    slackSend(channel: '#devops-ci', color: color, message: msg,
              tokenCredentialId: 'slack-token', botUser: true)
  } catch (err) {
    echo "Slack non disponible : ${err.getMessage()}"
  }
}

pipeline {
  agent any

  options {
    timestamps()
    buildDiscarder(logRotator(numToKeepStr: '10'))
  }

  triggers { pollSCM('H/2 * * * *') }

  environment {
    DOCKERHUB_USER      = 'groupe9'
    IMAGE               = "${DOCKERHUB_USER}/frontend"
    TAG                 = "1.0.${env.BUILD_NUMBER}"
    NEXT_PUBLIC_API_URL = 'http://localhost:3001'
  }

  stages {
    stage('Checkout') {
      steps { checkout scm }
    }

    stage('Installation') {
      steps {
        sh 'node -v'
        sh 'npm ci'
      }
    }

    stage('Lint') {
      steps { sh 'npm run lint' }
    }

    stage('Tests') {
      steps { sh 'npm test' }
    }

    stage('Scan du code (npm audit)') {
      steps {
        sh 'npm audit > npm-audit.txt || true'
        sh 'cat npm-audit.txt'
        catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
          sh 'npm audit --audit-level=high'
        }
      }
    }

    stage('Build') {
      steps { sh 'npm run build' }
    }

    stage('Build image Docker') {
      steps {
        sh '''
          docker build \
            --build-arg NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
            -t $IMAGE:$TAG -t $IMAGE:latest .
        '''
      }
    }

    stage('Scan Trivy') {
      steps {
        sh '''
          docker run --rm \
            -v /var/run/docker.sock:/var/run/docker.sock \
            -v trivy-cache:/root/.cache \
            aquasec/trivy:latest image \
            --severity HIGH,CRITICAL --exit-code 0 --no-progress \
            $IMAGE:$TAG | tee trivy-frontend.txt
        '''
      }
    }

    stage('Push Docker Hub') {
      when { anyOf { branch 'main'; branch 'develop' } }
      steps {
        withCredentials([usernamePassword(
            credentialsId: 'dockerhub-creds',
            usernameVariable: 'DH_USER',
            passwordVariable: 'DH_TOKEN')]) {
          sh '''
            echo "$DH_TOKEN" | docker login -u "$DH_USER" --password-stdin
            docker push $IMAGE:$TAG
            docker push $IMAGE:latest
          '''
        }
      }
    }
  }

  post {
    always {
      archiveArtifacts artifacts: 'npm-audit.txt, trivy-frontend.txt', allowEmptyArchive: true
      sh 'docker logout || true'
    }
    success {
      script { notify('good', "Frontend OK : ${env.IMAGE}:${env.TAG} (build #${env.BUILD_NUMBER})") }
    }
    failure {
      script { notify('danger', "Frontend ECHEC : build #${env.BUILD_NUMBER} ${env.BUILD_URL}") }
    }
  }
}