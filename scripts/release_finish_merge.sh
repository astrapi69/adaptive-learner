#!/usr/bin/env bash
# Merge a release or hotfix branch into main (no-ff), tag it, push both (#3904).
#
# Called by `make release-finish`. Works on a detached copy of <remote>/main
# instead of checking main out, so it also runs when another worktree holds
# main, and it checks both parents of the merge before it tags: a branch that
# is already in main makes `git merge` report "Already up to date" without a
# merge commit, and the tag would land on the wrong commit.
#
# Usage: scripts/release_finish_merge.sh <version> <branch> [remote]
#   <branch> is release/<version>-style or hotfix/<...>; anything else exits 2.
set -euo pipefail

version="${1:?usage: release_finish_merge.sh <version> <branch> [remote]}"
branch="${2:?usage: release_finish_merge.sh <version> <branch> [remote]}"
remote="${3:-origin}"

case "$branch" in
  release/* | hotfix/*) ;;
  *)
    echo "ERROR: only release/* and hotfix/* branches end on main, not '$branch'" >&2
    exit 2
    ;;
esac

if git show-ref --verify --quiet "refs/heads/$branch"; then
  git push "$remote" "$branch"
fi
git fetch "$remote" main "$branch"
main_sha=$(git rev-parse "refs/remotes/$remote/main")
branch_sha=$(git rev-parse "refs/remotes/$remote/$branch")

git switch --detach "$main_sha"
git merge --no-ff "$branch_sha" -m "Release v$version"

if [ "$(git rev-parse HEAD^1 2>/dev/null)" != "$main_sha" ] ||
  [ "$(git rev-parse HEAD^2 2>/dev/null)" != "$branch_sha" ]; then
  echo "ERROR: no merge commit of $remote/main and $branch (already merged?); nothing tagged" >&2
  exit 1
fi

git tag -a "v$version" -m "Release v$version"
git push "$remote" HEAD:main
git push "$remote" "refs/tags/v$version"
echo "main is $(git rev-parse --short HEAD) (parents $remote/main and $branch), tagged v$version"
