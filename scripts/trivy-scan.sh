#!/bin/sh
# Scan Trivy de l'image, en deux passes :
#   1) rapport JSON complet (ne fait jamais echouer le build) ;
#   2) verification bloquante HIGH/CRITICAL, lisible dans la console.
# Le cache (volume trivy-cache) rend la 2e passe rapide.
#
# Entrees : TRIVY_IMAGE, IMAGE_NAME, RELEASE_VERSION, WORKSPACE
# Sortie  : reports/trivy.json
# Code de retour : 0 si aucune vulnerabilite HIGH/CRITICAL, 1 sinon.

set -u
. "$(dirname "$0")/lib.sh"

require_env TRIVY_IMAGE IMAGE_NAME RELEASE_VERSION WORKSPACE

mkdir -p reports

report() {
    docker run --rm \
        -v trivy-cache:/root/.cache/trivy \
        -v /var/run/docker.sock:/var/run/docker.sock \
        -v jenkins_home:/var/jenkins_home \
        "$TRIVY_IMAGE" \
        image \
        --severity HIGH,CRITICAL \
        --format json \
        --output "$WORKSPACE/reports/trivy.json" \
        --exit-code 0 \
        "${IMAGE_NAME}:${RELEASE_VERSION}"
}

# 1) Rapport JSON. Rejouable : un echec ici est un probleme de telechargement de la base, pas un resultat de scan.
retry "rapport Trivy" report || fail "le rapport Trivy n'a pas pu etre produit"

# 2) Verification bloquante. Pas de reprise : un code 1 est un resultat, pas une panne.
docker run --rm \
    -v trivy-cache:/root/.cache/trivy \
    -v /var/run/docker.sock:/var/run/docker.sock \
    "$TRIVY_IMAGE" \
    image \
    --severity HIGH,CRITICAL \
    --exit-code 1 \
    "${IMAGE_NAME}:${RELEASE_VERSION}"
