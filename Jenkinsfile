// Expected parameters:
// - image_tag: Tag that will be used for the new image.
// - build_image: Base image that the image being built extends.
pipeline {
    agent any
    environment {
        image_repo = "concordium/dapp-piggybank"
        image_name = "${image_repo}:${image_tag}"
    }
    stages {
        stage('dockerhub-login') {
            environment {
                // Defines 'CRED_USR' and 'CRED_PSW'
                // (see 'https://www.jenkins.io/doc/book/pipeline/jenkinsfile/#handling-credentials').
                CRED = credentials('jenkins-dockerhub')
            }
            steps {
                sh 'docker login --username "${CRED_USR}" --password "${CRED_PSW}"'
            }
        }
        stage('build-push') {
            steps {
                sh '''\
                    docker build \
                      --build-arg build_image="${build_image}" \
                      --label build_image="${build_image}" \
                      --tag="${image_name}" \
                      --pull \
                      .
                    docker push "${image_name}"
                '''.stripIndent()
            }
        }
    }
}
