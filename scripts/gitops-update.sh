#!/bin/sh
# Mise a jour du depot GitOps : remplace "newTag:" par la version a deployer, commit, push.
# Jamais de --force. Le script s'arrete a la moindre anomalie (fail-closed).
#
# Entrees (variables d'environnement) :
#   GITOPS_REPO_URL  depot GitOps (GitLab)
#   GITOPS_APP_FILE  fichier kustomization contenant "newTag:"
#   GITOPS_TOKEN     token d'ecriture du depot GitOps
#   DEPLOY_VERSION   version a ecrire (vX.Y.Z)
#   APP_NAME         nom de l'application, pour le message du commit (ex. fixbook-front)
#   GITOPS_MODE      deploy | reconcile | rollback
#   TRIGGERED_BY     qui a declenche le build (trace dans le commit)
#   REASON           (facultatif) raison de la modification (trace dans le commit)
#   BUILD_URL        lien du build (trace dans le commit)
#   GITOPS_COMMIT_USER / GITOPS_COMMIT_EMAIL   (facultatifs) identite du commit
#
# Sorties dans le dossier courant : gitops-update.log et gitops-update.tail
# Code de retour : 0 si GitOps contient la version voulue a la fin, 1 sinon.

set -u
. "$(dirname "$0")/lib.sh"

rm -f gitops-update.log gitops-update.tail

clone_gitops() {
    rm -rf gitops-repo
    git clone -q "$GITOPS_REPO_URL" gitops-repo
}

update() {
    require_env GITOPS_REPO_URL GITOPS_APP_FILE GITOPS_TOKEN DEPLOY_VERSION APP_NAME GITOPS_MODE || exit 1

    # GitLab : le nom d'utilisateur est libre (non vide) avec un token d'acces
    git_auth_env oauth2 "$GITOPS_TOKEN"

    # 1) clone avec reprises
    retry "clone du depot GitOps" clone_gitops \
        || { echo "ERREUR : clone du repo GitOps impossible apres plusieurs essais"; exit 1; }

    cd gitops-repo || exit 1

    # 2) exactement une ligne newTag: attendue, sinon on s'arrete
    COUNT=$(grep -Ec '^[[:space:]]*newTag:' "$GITOPS_APP_FILE" || true)
    [ "$COUNT" = "1" ] \
        || { echo "ERREUR : ${COUNT} ligne(s) newTag: dans ${GITOPS_APP_FILE} (une seule attendue)"; exit 1; }

    # 3) remplacement puis verification exacte
    OLD_TAG=$(read_tag < "$GITOPS_APP_FILE")
    sed -i -E "s|^([[:space:]]*)newTag:.*|\1newTag: ${DEPLOY_VERSION}|" "$GITOPS_APP_FILE"
    [ "$(read_tag < "$GITOPS_APP_FILE")" = "$DEPLOY_VERSION" ] \
        || { echo "ERREUR : ${DEPLOY_VERSION} absent de ${GITOPS_APP_FILE} apres modification"; exit 1; }

    git config user.name  "${GITOPS_COMMIT_USER:-jenkins-ci}"
    git config user.email "${GITOPS_COMMIT_EMAIL:-jenkins-ci@users.noreply.gitlab.com}"
    git add "$GITOPS_APP_FILE"

    if git diff --cached --quiet; then
        echo "GitOps contient deja ${DEPLOY_VERSION}, rien a faire."
        exit 0
    fi

    git commit -q \
        -m "chore(${APP_NAME}): ${GITOPS_MODE} ${DEPLOY_VERSION}" \
        -m "Ancienne version : ${OLD_TAG}" \
        -m "Mode : ${GITOPS_MODE}" \
        -m "Declenche par : ${TRIGGERED_BY:-inconnu}" \
        -m "Raison : ${REASON:-non precisee}" \
        -m "Build : ${BUILD_URL:-inconnu}"

    # 4) push avec resynchronisation entre les essais (jamais de --force)
    PUSHED=0
    for delay in 0 $RETRY_DELAYS; do
        if [ "$delay" -gt 0 ]; then
            echo "Push refuse : resynchronisation puis nouvel essai dans ${delay} s..."
            sleep "$delay"
            git pull -q --rebase origin main || true
        fi
        if git push -q origin HEAD:main; then
            PUSHED=1
            break
        fi
    done
    [ "$PUSHED" = "1" ] || { echo "ERREUR : push GitOps impossible apres plusieurs essais"; exit 1; }

    # 5) controle final sur le depot distant
    git fetch -q origin main || { echo "ERREUR : controle final impossible (fetch)"; exit 1; }
    [ "$(git show "origin/main:${GITOPS_APP_FILE}" | read_tag)" = "$DEPLOY_VERSION" ] \
        || { echo "ERREUR : le depot distant ne contient pas ${DEPLOY_VERSION}"; exit 1; }
    echo "GitOps mis a jour : ${DEPLOY_VERSION}"
}

ST=0
( update ) > gitops-update.log 2>&1 || ST=$?

cat gitops-update.log
tail -n 15 gitops-update.log > gitops-update.tail
exit "$ST"
