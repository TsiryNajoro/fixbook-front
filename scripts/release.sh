#!/bin/sh
# Lance semantic-release dans un conteneur Node.
#   sh scripts/release.sh dry-run    calcule la prochaine version, ne publie rien
#   sh scripts/release.sh publish    cree le tag et la release GitHub, puis verifie que le tag existe
#
# Entrees (variables d'environnement) :
#   NODE_IMAGE       image Node a utiliser
#   GH_TOKEN         token d'acces au depot applicatif (tag + release)
#   GIT_COMMIT       commit construit par Jenkins
#   WORKSPACE        workspace Jenkins
#   RELEASE_VERSION  (publish) version attendue, verifiee apres la release
#
# La sortie standard est celle de semantic-release : le Jenkinsfile y cherche
# "The next release version is X.Y.Z" en mode dry-run.

set -u
. "$(dirname "$0")/lib.sh"

MODE=${1:-}
case "$MODE" in
    dry-run|publish) ;;
    *) fail "usage : release.sh dry-run|publish" ;;
esac

require_env NODE_IMAGE GH_TOKEN GIT_COMMIT WORKSPACE

# En mode publish seulement : semantic-release doit se croire en CI pour publier.
CI_ENV=""
[ "$MODE" = "publish" ] && CI_ENV="-e CI=true"

# set +x : aucune trace des variables sensibles
set +x
# shellcheck disable=SC2086
docker run --rm \
    $CI_ENV \
    -e RELEASE_VERSION \
    -e GH_TOKEN \
    -e GIT_COMMIT="$GIT_COMMIT" \
    -v jenkins_home:/var/jenkins_home \
    -w "$WORKSPACE" \
    "$NODE_IMAGE" \
    sh -e scripts/release-inner.sh "$MODE"
