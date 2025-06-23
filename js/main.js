import { initAvailability } from './availability.js';
// ... existing imports and code ...

// inside upload event and room filter change, after initCalendar:
initCalendar(currentData);
initAvailability(currentData);
