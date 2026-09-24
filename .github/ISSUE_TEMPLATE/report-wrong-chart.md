name: Report a wrong chart
description: Flag a chart that looks wrong for its story
title: "[chart] Wick #DAY — what looks wrong"
labels: [data-issue]
body:
  - type: input
    id: day
    attributes: { label: "Wick # (day number)", placeholder: "e.g. 12" }
    validations: { required: true }
  - type: textarea
    id: what
    attributes: { label: "What looks wrong?", description: "No spoilers beyond the day you played. Describe the mismatch." }
    validations: { required: true }
  - type: textarea
    id: expected
    attributes: { label: "What did you expect?" }
    validations: { required: false }
