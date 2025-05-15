const terms = ['summer2025'];

function fetchSchedule(term) {
  return fetch(`data/${term}.json`)
    .then(response => response.json());
}

export { terms, fetchSchedule };
