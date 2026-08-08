#!/usr/bin/env bash
#
# Records a booking, retrying if another booking gets committed first.
#
# There is deliberately no `concurrency` group on this workflow. GitHub keeps only one pending
# run per group and cancels any earlier pending one, so with three bookings arriving at once the
# middle one would be silently thrown away. Instead every run reads the latest bookings, checks
# availability against them, and pushes. A run that loses the race re-reads the winner's booking
# and re-checks availability, so the last seats can only ever be sold once.

set -euo pipefail

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

branch="${GITHUB_REF_NAME}"

for attempt in 1 2 3 4 5; do
  git fetch --quiet origin "$branch"
  git reset --quiet --hard "origin/$branch"

  node .github/scripts/process-booking.js

  if [ -z "$(git status --porcelain data/bookings.json)" ]; then
    echo "Nothing to write - the request was refused or changed nothing."
    exit 0
  fi

  git add data/bookings.json
  git commit --quiet --file "${RUNNER_TEMP}/commit-message.txt"

  if git push --quiet origin "HEAD:$branch"; then
    echo "Saved on attempt ${attempt}."
    exit 0
  fi

  echo "Another booking got there first. Re-checking availability..."
  sleep "$(( (RANDOM % 4) + 1 ))"
done

echo "Could not save the booking after 5 attempts." >&2
exit 1
