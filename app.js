/*
 * Workout Tracker Application
 *
 * This script implements a single–page workout tracker using a
 * minimal custom React (see myreact.js). All state is managed at
 * the top level within a single functional component to avoid
 * mismatch issues when components mount or unmount. The app
 * supports logging workouts, creating weekly plans, visualising
 * progress with charts, computing statistics and exporting CSVs.
 */

// --------------------- Utility Functions ---------------------

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDate(str) {
  const parts = str.split('-');
  if (parts.length !== 3) return new Date(0);
  const [y, m, d] = parts.map(Number);
  return new Date(y, m - 1, d);
}

function loadEntries() {
  try {
    const data = localStorage.getItem('workoutEntries');
    if (data) {
      const entries = JSON.parse(data);
      entries.sort((a, b) => {
        const dateDiff = new Date(a.date) - new Date(b.date);
        if (dateDiff !== 0) return dateDiff;
        return a.exercise.localeCompare(b.exercise);
      });
      return entries;
    }
  } catch (err) {
    console.error('Failed to load entries:', err);
  }
  return [];
}

function saveEntries(entries) {
  try {
    localStorage.setItem('workoutEntries', JSON.stringify(entries));
  } catch (err) {
    console.error('Failed to save entries:', err);
  }
}

function loadPlan() {
  try {
    const data = localStorage.getItem('workoutPlan');
    if (data) {
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to load plan:', err);
  }
  return null;
}

function savePlan(plan) {
  try {
    if (plan) {
      localStorage.setItem('workoutPlan', JSON.stringify(plan));
    } else {
      localStorage.removeItem('workoutPlan');
    }
  } catch (err) {
    console.error('Failed to save plan:', err);
  }
}

function getUniqueExercises(entries) {
  const set = new Set();
  entries.forEach((e) => set.add(e.exercise));
  return Array.from(set).sort();
}

function calculateGlobalAverages(entries) {
  if (!entries || entries.length === 0) {
    return { averageWeight: 0, averageReps: 0 };
  }
  let weightSum = 0;
  let repsSum = 0;
  entries.forEach((e) => {
    weightSum += Number(e.weight) || 0;
    repsSum += Number(e.reps) || 0;
  });
  const avgW = weightSum / entries.length;
  const avgR = repsSum / entries.length;
  return {
    averageWeight: Math.round(avgW * 100) / 100,
    averageReps: Math.round(avgR * 100) / 100,
  };
}

function calculatePRs(entries) {
  const prMap = {};
  entries.forEach((e) => {
    if (!prMap[e.exercise]) {
      prMap[e.exercise] = { maxWeight: Number(e.weight) || 0, maxReps: Number(e.reps) || 0 };
    } else {
      const current = prMap[e.exercise];
      if (Number(e.weight) > current.maxWeight) current.maxWeight = Number(e.weight);
      if (Number(e.reps) > current.maxReps) current.maxReps = Number(e.reps);
    }
  });
  return Object.keys(prMap)
    .map((ex) => ({ exercise: ex, ...prMap[ex] }))
    .sort((a, b) => a.exercise.localeCompare(b.exercise));
}

function calculateVolumePerExercise(entries) {
  const volumeMap = {};
  entries.forEach((e) => {
    const vol = (Number(e.weight) || 0) * (Number(e.reps) || 0);
    volumeMap[e.exercise] = (volumeMap[e.exercise] || 0) + vol;
  });
  return volumeMap;
}

function exportCSV(entries) {
  if (!entries || entries.length === 0) return;
  const header = 'date,exercise,weight,reps,notes';
  const lines = entries.map((e) => {
    const safeNotes = (e.notes || '').replace(/,/g, ';');
    return [e.date, e.exercise, e.weight, e.reps, safeNotes].join(',');
  });
  const csv = [header].concat(lines).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'workouts.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Predefined exercises suggested by the user.  This list is used to
// initialise the exercise bank when no prior bank exists in
// localStorage.  Users can later add additional exercises to the
// bank via the UI.
const DEFAULT_EXERCISES = [
  'Leg press',
  'Lying leg curl',
  'Hip abduction machine',
  'Hip adduction machine',
  'Lunges with weights',
  'Planking',
  'Side planking',
  'Triceps push down',
  'Chest press machine',
  'Seated cable row',
  'Lat pull-down',
  'Biceps curl (Barbell)',
  'Shoulder press machine',
  'Leg extension',
  'Hip thrusts',
  'Bulgarian split squat',
  'Single deadlift with weight',
  'Clamshells',
  'Alternating leg lower',
  'Deadbug',
  'Heel touch',
  'Crunches',
  'Side crunches',
];

// Load the exercise bank from localStorage.  If the bank does not
// exist, initialise it with the default exercises defined above.
function loadExerciseBank() {
  /**
   * Load the exercise bank from localStorage.  If an existing bank
   * is found, merge it with the DEFAULT_EXERCISES so that any new
   * defaults are always available.  The resulting list is sorted
   * alphabetically and persisted back to localStorage to ensure
   * subsequent loads include the full set.  If parsing fails or no
   * bank is found, a fresh copy of DEFAULT_EXERCISES is used.
   */
  let bank = [];
  try {
    const data = localStorage.getItem('exerciseBank');
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        bank = parsed;
      }
    }
  } catch (err) {
    console.error('Failed to load exercise bank:', err);
  }
  // Merge loaded bank with default exercises.  Use a Set to
  // eliminate duplicates then sort the array alphabetically.
  const merged = Array.from(new Set([...bank, ...DEFAULT_EXERCISES])).sort((a, b) => a.localeCompare(b));
  try {
    localStorage.setItem('exerciseBank', JSON.stringify(merged));
  } catch (err) {
    console.error('Failed to persist exercise bank:', err);
  }
  return merged;
}

// Save the exercise bank to localStorage
function saveExerciseBank(bank) {
  try {
    localStorage.setItem('exerciseBank', JSON.stringify(bank));
  } catch (err) {
    console.error('Failed to save exercise bank:', err);
  }
}

// Chart drawing functions copied from earlier implementation

function drawLineChart(canvas, labels, weightData, repsData, exerciseName) {
  const ctx = canvas.getContext('2d');
  // Handle high DPI displays by scaling the canvas based on the device
  // pixel ratio.  The canvas's CSS size is determined by its parent
  // container; use getBoundingClientRect() to get that size.  Then
  // multiply by the devicePixelRatio and scale the context so the
  // rendering remains crisp.  Without this adjustment, charts appear
  // blurry on mobile and high‑resolution screens.
  const rect = canvas.getBoundingClientRect();
  const cssWidth = rect.width;
  const cssHeight = rect.height;
  const dpr = window.devicePixelRatio || 1;
  // Only resize the canvas if its internal size differs from the
  // desired size.  This avoids clearing the canvas unnecessarily.
  if (canvas.width !== cssWidth * dpr || canvas.height !== cssHeight * dpr) {
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    ctx.scale(dpr, dpr);
  }
  const width = cssWidth;
  const height = cssHeight;
  ctx.clearRect(0, 0, width, height);
  if (!labels || labels.length === 0) {
    ctx.fillStyle = '#666';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No data available', width / 2, height / 2);
    return;
  }
  const margin = { left: 50, right: 50, top: 50, bottom: 60 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const minWeight = 0;
  const maxWeight = Math.max(...weightData, 1);
  const minReps = 0;
  const maxReps = Math.max(...repsData, 1);
  const weightToY = (val) => margin.top + chartHeight - ((val - minWeight) / (maxWeight - minWeight)) * chartHeight;
  const repsToY = (val) => margin.top + chartHeight - ((val - minReps) / (maxReps - minReps)) * chartHeight;
  const indexToX = (i) => (labels.length === 1 ? margin.left + chartWidth / 2 : margin.left + (chartWidth * i) / (labels.length - 1));
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(margin.left, margin.top + chartHeight);
  ctx.lineTo(margin.left + chartWidth, margin.top + chartHeight);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(margin.left, margin.top);
  ctx.lineTo(margin.left, margin.top + chartHeight);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(margin.left + chartWidth, margin.top);
  ctx.lineTo(margin.left + chartWidth, margin.top + chartHeight);
  ctx.stroke();
  const yTickCount = 5;
  ctx.fillStyle = '#666';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'right';
  for (let i = 0; i <= yTickCount; i++) {
    const value = minWeight + ((maxWeight - minWeight) * i) / yTickCount;
    const y = weightToY(value);
    ctx.strokeStyle = '#eee';
    ctx.beginPath();
    ctx.moveTo(margin.left, y);
    ctx.lineTo(margin.left + chartWidth, y);
    ctx.stroke();
    ctx.fillStyle = '#666';
    ctx.fillText(value.toFixed(0), margin.left - 5, y + 3);
  }
  ctx.textAlign = 'left';
  for (let i = 0; i <= yTickCount; i++) {
    const value = minReps + ((maxReps - minReps) * i) / yTickCount;
    const y = repsToY(value);
    ctx.fillStyle = '#666';
    ctx.fillText(value.toFixed(0), margin.left + chartWidth + 5, y + 3);
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = '#666';
  const labelCount = labels.length;
  const skip = labelCount > 8 ? Math.ceil(labelCount / 8) : 1;
  for (let i = 0; i < labelCount; i++) {
    const x = indexToX(i);
    if (i % skip === 0 || i === labelCount - 1) {
      const parts = labels[i].split('-');
      const month = parseInt(parts[1]);
      const day = parseInt(parts[2]);
      const lbl = `${month}/${day}`;
      ctx.save();
      ctx.translate(x, margin.top + chartHeight + 15);
      ctx.rotate(-Math.PI / 6);
      ctx.fillText(lbl, 0, 0);
      ctx.restore();
    }
  }
  ctx.strokeStyle = '#007bff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  weightData.forEach((val, i) => {
    const x = indexToX(i);
    const y = weightToY(val);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.strokeStyle = '#dc3545';
  ctx.beginPath();
  repsData.forEach((val, i) => {
    const x = indexToX(i);
    const y = repsToY(val);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  for (let i = 0; i < labelCount; i++) {
    const x = indexToX(i);
    const yW = weightToY(weightData[i]);
    ctx.fillStyle = '#007bff';
    ctx.beginPath();
    ctx.arc(x, yW, 3, 0, Math.PI * 2);
    ctx.fill();
    const yR = repsToY(repsData[i]);
    ctx.fillStyle = '#dc3545';
    ctx.beginPath();
    ctx.arc(x, yR, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#333';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${exerciseName} Progress`, margin.left + chartWidth / 2, margin.top - 20);
  const legendX = margin.left + 5;
  const legendY = margin.top - 5;
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#007bff';
  ctx.fillRect(legendX, legendY, 8, 8);
  ctx.fillStyle = '#333';
  ctx.fillText('Weight', legendX + 12, legendY + 7);
  const secondX = legendX + 70;
  ctx.fillStyle = '#dc3545';
  ctx.fillRect(secondX, legendY, 8, 8);
  ctx.fillStyle = '#333';
  ctx.fillText('Reps', secondX + 12, legendY + 7);
}

function drawBarChart(canvas, labels, data) {
  const ctx = canvas.getContext('2d');
  // Scale the canvas for high DPI displays using the same technique as
  // drawLineChart().  This ensures bar charts remain crisp on mobile
  // devices and high‑resolution screens.
  const rect = canvas.getBoundingClientRect();
  const cssWidth = rect.width;
  const cssHeight = rect.height;
  const dpr = window.devicePixelRatio || 1;
  if (canvas.width !== cssWidth * dpr || canvas.height !== cssHeight * dpr) {
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    ctx.scale(dpr, dpr);
  }
  const width = cssWidth;
  const height = cssHeight;
  ctx.clearRect(0, 0, width, height);
  if (!labels || labels.length === 0) {
    ctx.fillStyle = '#666';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No data available', width / 2, height / 2);
    return;
  }
  const margin = { left: 50, right: 30, top: 40, bottom: 70 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const maxVal = Math.max(...data, 1);
  const barCount = labels.length;
  const spacingRatio = 0.3;
  const barWidth = chartWidth / (barCount * (1 + spacingRatio) + spacingRatio);
  const spacing = barWidth * spacingRatio;
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(margin.left, margin.top);
  ctx.lineTo(margin.left, margin.top + chartHeight);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(margin.left, margin.top + chartHeight);
  ctx.lineTo(margin.left + chartWidth, margin.top + chartHeight);
  ctx.stroke();
  const yTicks = 5;
  ctx.font = '10px sans-serif';
  ctx.fillStyle = '#666';
  ctx.textAlign = 'right';
  for (let i = 0; i <= yTicks; i++) {
    const value = (maxVal * i) / yTicks;
    const y = margin.top + chartHeight - (chartHeight * i) / yTicks;
    ctx.strokeStyle = '#eee';
    ctx.beginPath();
    ctx.moveTo(margin.left, y);
    ctx.lineTo(margin.left + chartWidth, y);
    ctx.stroke();
    ctx.fillStyle = '#666';
    ctx.fillText(value.toFixed(0), margin.left - 5, y + 3);
  }
  const colours = ['#007bff', '#28a745', '#ffc107', '#17a2b8', '#fd7e14', '#6f42c1', '#e83e8c'];
  ctx.textAlign = 'center';
  ctx.fillStyle = '#333';
  labels.forEach((label, idx) => {
    const value = data[idx];
    const barHeight = (value / maxVal) * chartHeight;
    const x = margin.left + spacing + idx * (barWidth + spacing);
    const y = margin.top + chartHeight - barHeight;
    ctx.fillStyle = colours[idx % colours.length];
    ctx.fillRect(x, y, barWidth, barHeight);
    ctx.save();
    ctx.translate(x + barWidth / 2, margin.top + chartHeight + 5);
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = '#333';
    ctx.fillText(label, 0, 0);
    ctx.restore();
  });
  ctx.fillStyle = '#333';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Total Volume per Exercise', margin.left + chartWidth / 2, margin.top - 15);
}

// --------------------- Main Application Component ---------------------

function App() {
  // Navigation state: 'log', 'plan', 'progress'
  const [view, setView] = React.useState('log');
  // Persisted data
  const [entries, setEntries] = React.useState(loadEntries());
  const [plan, setPlan] = React.useState(loadPlan());
  // Log page state
  const [logDate, setLogDate] = React.useState(formatDate(new Date()));
  const [logExercise, setLogExercise] = React.useState('');
  const [logWeight, setLogWeight] = React.useState('');
  const [logReps, setLogReps] = React.useState('');
  const [logNotes, setLogNotes] = React.useState('');
  const [logMessage, setLogMessage] = React.useState(null);
  const [logMessageType, setLogMessageType] = React.useState('success');
  const [groupWeights, setGroupWeights] = React.useState({});
  const [groupReps, setGroupReps] = React.useState({});
  // When logging an exercise, the user can select from the bank via a
  // dropdown.  Selecting "Other" reveals a custom input field.  This
  // state tracks whether that custom input should be shown.
  const [showLogCustomInput, setShowLogCustomInput] = React.useState(false);
  // Exercise bank state.  This list is persisted in localStorage and
  // prepopulated with a set of common exercises.  Users can add to
  // this bank via the log page.
  const [exerciseBank, setExerciseBank] = React.useState(loadExerciseBank());

  // --- Microsoft Clarity integration for single‑page navigation ---
  /**
   * Notify Microsoft Clarity when the user navigates to a new tab inside
   * this single-page application.  Without this call, Clarity may treat
   * all interactions as occurring on a single page, which can cause
   * heatmaps and dashboard reports to appear empty or greyed out.
   *
   * @param {string} viewName The logical page name (e.g., 'log', 'plan', 'progress').
   */
  function trackClarity(viewName) {
    if (typeof window !== 'undefined' && typeof window.clarity === 'function') {
      try {
        // Update the `page` tag for Clarity.  Clarity queues this call
        // internally if its script has not finished loading.
        window.clarity('set', 'page', viewName);
      } catch (err) {
        // Silently ignore any errors if Clarity is not ready.
        console.debug('Clarity track failed', err);
      }
    }
  }
  // Plan page state
  const [planSelectedDays, setPlanSelectedDays] = React.useState({});
  const [planExercises, setPlanExercises] = React.useState({});
  const [planEndDate, setPlanEndDate] = React.useState('');
  const [planMessage, setPlanMessage] = React.useState(null);
  const [planMessageType, setPlanMessageType] = React.useState('success');
  // Determine scheduled exercises for logDate if plan exists
  let scheduledExercises = [];
  if (plan && plan.schedule && plan.schedule[logDate]) {
    scheduledExercises = plan.schedule[logDate];
  }
  // Unique exercises for suggestions
  const uniqueExercises = getUniqueExercises(entries);
  // Combine exercises from the bank with those that have been logged
  // previously.  Using a Set ensures duplicates are removed.  The
  // resulting list is sorted alphabetically for display in the
  // datalist of the exercise input.
  const datalistOptions = Array.from(new Set([...exerciseBank, ...uniqueExercises])).sort();

  // Add the current value of the exercise input to the bank if it
  // doesn’t already exist.  Provides feedback via the logMessage
  // state when an exercise is added or when an attempt is made to
  // add an empty or duplicate entry.
  function handleAddExerciseToBank() {
    const trimmed = logExercise.trim();
    if (!trimmed) {
      setLogMessage('Please enter an exercise name to add to the bank.');
      setLogMessageType('error');
      return;
    }
    if (exerciseBank.includes(trimmed)) {
      setLogMessage('Exercise already exists in the bank.');
      setLogMessageType('error');
      return;
    }
    const updated = [...exerciseBank, trimmed].sort((a, b) => a.localeCompare(b));
    saveExerciseBank(updated);
    setExerciseBank(updated);
    // Set the selected exercise to the newly added value and hide the
    // custom input field.  This ensures the dropdown reflects the
    // addition immediately.
    setShowLogCustomInput(false);
    setLogExercise(trimmed);
    setLogMessage('Exercise added to the bank!');
    setLogMessageType('success');
  }

  /**
   * When the user selects an exercise from the dropdown on the log page,
   * update the current exercise accordingly.  Selecting the special
   * "Other" option reveals a custom input field.  Selecting any other
   * option hides the custom input and stores the chosen exercise.
   *
   * @param {string} value The selected value from the dropdown.
   */
  function handleLogSelectChange(value) {
    if (value === '__other__') {
      setShowLogCustomInput(true);
      // Clear the current exercise so that the user can type a new one
      setLogExercise('');
    } else {
      setShowLogCustomInput(false);
      setLogExercise(value);
    }
  }

  /**
   * Add all exercises from the plan form to the exercise bank.
   * Iterate over the comma‑separated exercise lists for each selected
   * day and add any new exercises to the bank.  Provides feedback to
   * inform the user how many new exercises were added (if any).  If
   * there are no new exercises to add, an error message is shown.
   */
  function handleAddPlanExercisesToBank() {
    // Gather all exercises from the current plan form
    const bank = [...exerciseBank];
    let count = 0;
    Object.values(planExercises).forEach((list) => {
      list.forEach((ex) => {
        const name = ex.trim();
        if (name && !bank.includes(name)) {
          bank.push(name);
          count++;
        }
      });
    });
    if (count > 0) {
      bank.sort((a, b) => a.localeCompare(b));
      setExerciseBank(bank);
      saveExerciseBank(bank);
      setPlanMessage(`${count} exercise${count === 1 ? '' : 's'} added to bank.`);
      setPlanMessageType('success');
    } else {
      setPlanMessage('No new exercises found to add.');
      setPlanMessageType('error');
    }
  }
  // Event handlers for logging individual workouts
  function handleLogSubmit(e) {
    e.preventDefault();
    const trimmedExercise = logExercise.trim();
    if (!logDate) {
      setLogMessage('Please select a date.');
      setLogMessageType('error');
      return;
    }
    if (!trimmedExercise) {
      setLogMessage('Please enter an exercise name.');
      setLogMessageType('error');
      return;
    }
    const w = parseFloat(logWeight);
    const r = parseInt(logReps, 10);
    if (isNaN(w) || w <= 0) {
      setLogMessage('Please enter a valid weight.');
      setLogMessageType('error');
      return;
    }
    if (isNaN(r) || r <= 0) {
      setLogMessage('Please enter a valid reps count.');
      setLogMessageType('error');
      return;
    }
    const newEntry = {
      id: Date.now(),
      date: logDate,
      exercise: trimmedExercise,
      weight: w,
      reps: r,
      notes: logNotes.trim(),
    };
    const updated = [...entries, newEntry];
    saveEntries(updated);
    setEntries(updated);
    setLogExercise('');
    setLogWeight('');
    setLogReps('');
    setLogNotes('');
    setLogMessage('Workout logged successfully!');
    setLogMessageType('success');
  }
  // Handler for logging group workouts
  function handleGroupSubmit(e) {
    e.preventDefault();
    if (!logDate) {
      setLogMessage('Please select a date.');
      setLogMessageType('error');
      return;
    }
    const newEntries = [];
    for (const ex of scheduledExercises) {
      const w = parseFloat(groupWeights[ex]);
      const r = parseInt(groupReps[ex], 10);
      if (isNaN(w) || w <= 0 || isNaN(r) || r <= 0) {
        setLogMessage(`Please enter valid weight and reps for ${ex}.`);
        setLogMessageType('error');
        return;
      }
      newEntries.push({
        id: Date.now() + Math.random(),
        date: logDate,
        exercise: ex,
        weight: w,
        reps: r,
        notes: '',
      });
    }
    const updated = entries.concat(newEntries);
    saveEntries(updated);
    setEntries(updated);
    setGroupWeights({});
    setGroupReps({});
    setLogMessage('Planned workouts logged successfully!');
    setLogMessageType('success');
  }
  // Event handlers for plan page
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function togglePlanDay(idx) {
    const current = !!planSelectedDays[idx];
    const newState = { ...planSelectedDays, [idx]: !current };
    setPlanSelectedDays(newState);
    if (current) {
      // Deselecting the day: remove its exercises from the plan
      const copy = { ...planExercises };
      delete copy[idx];
      setPlanExercises(copy);
    } else {
      // Selecting the day: initialise with a single empty exercise row
      if (!planExercises[idx]) {
        setPlanExercises({ ...planExercises, [idx]: [''] });
      }
    }
  }
  // Add a new exercise row for the specified day.  The new row
  // initially contains an empty string, which will trigger the
  // "Other" input field in the UI.
  function addPlanExerciseRow(dayIdx) {
    const list = planExercises[dayIdx] ? planExercises[dayIdx].slice() : [];
    list.push('');
    setPlanExercises({ ...planExercises, [dayIdx]: list });
  }

  // Remove the exercise row at the given index for the specified day.
  function removePlanExerciseRow(dayIdx, rowIndex) {
    const list = planExercises[dayIdx] ? planExercises[dayIdx].slice() : [];
    list.splice(rowIndex, 1);
    setPlanExercises({ ...planExercises, [dayIdx]: list });
  }

  // Handle a change in the exercise selection dropdown for a given
  // day/index.  Selecting the special value '__other__' will replace
  // the current value with an empty string to trigger the custom
  // input field in the UI.  Otherwise, store the selected exercise.
  function handlePlanExerciseSelectChange(dayIdx, rowIndex, value) {
    const list = planExercises[dayIdx] ? planExercises[dayIdx].slice() : [];
    if (value === '__other__') {
      list[rowIndex] = '';
    } else {
      list[rowIndex] = value;
    }
    setPlanExercises({ ...planExercises, [dayIdx]: list });
  }

  // Handle updates to the custom exercise input field for a given
  // day/index.  Simply store the typed value in the corresponding
  // position of the planExercises list.
  function handlePlanExerciseInputChange(dayIdx, rowIndex, value) {
    const list = planExercises[dayIdx] ? planExercises[dayIdx].slice() : [];
    list[rowIndex] = value;
    setPlanExercises({ ...planExercises, [dayIdx]: list });
  }
  function handleSavePlan(e) {
    e.preventDefault();
    // Build selected indices
    const dayIndices = Object.entries(planSelectedDays)
      .filter(([k, v]) => v && !isNaN(Number(k)) && dayNames[Number(k)] !== undefined)
      .map(([k]) => Number(k));
    if (dayIndices.length === 0) {
      setPlanMessage('Please select at least one day.');
      setPlanMessageType('error');
      return;
    }
    for (const di of dayIndices) {
      // Filter out empty or whitespace-only entries to handle rows where
      // the user hasn’t selected an exercise or left the custom field blank
      const exs = (planExercises[di] || []).map((s) => s.trim()).filter((s) => s.length > 0);
      if (!exs || exs.length === 0) {
        setPlanMessage(`Please enter at least one exercise for ${dayNames[di]}.`);
        setPlanMessageType('error');
        return;
      }
    }
    if (!planEndDate) {
      setPlanMessage('Please select an end date.');
      setPlanMessageType('error');
      return;
    }
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const end = parseDate(planEndDate);
    if (end < now) {
      setPlanMessage('End date must not be in the past.');
      setPlanMessageType('error');
      return;
    }
    const planObj = { days: {}, startDate: formatDate(now), endDate: planEndDate, schedule: {} };
    dayIndices.forEach((di) => {
      const exs = (planExercises[di] || []).map((s) => s.trim()).filter((s) => s.length > 0);
      planObj.days[di] = exs;
    });
    const totalDays = Math.floor((end - now) / (1000 * 60 * 60 * 24));
    for (let i = 0; i <= totalDays; i++) {
      const date = new Date(now);
      date.setDate(now.getDate() + i);
      const dow = date.getDay();
      const exs = planObj.days[dow];
      if (exs && exs.length > 0) {
        planObj.schedule[formatDate(date)] = exs.slice();
      }
    }
    savePlan(planObj);
    setPlan(planObj);
    setPlanSelectedDays({});
    setPlanExercises({});
    setPlanEndDate('');
    setPlanMessage('Plan saved successfully!');
    setPlanMessageType('success');
  }
  function handleClearPlan() {
    savePlan(null);
    setPlan(null);
    setPlanMessage('Plan cleared.');
    setPlanMessageType('success');
  }
  function getUpcomingSchedule() {
    if (!plan || !plan.schedule) return [];
    const list = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateStr = formatDate(date);
      if (plan.schedule[dateStr]) {
        list.push({ date: dateStr, exercises: plan.schedule[dateStr] });
      }
    }
    return list;
  }
  // Draw charts when on progress page
  if (view === 'progress') {
    setTimeout(() => {
      const volCanvas = document.getElementById('volume-bar-chart');
      if (volCanvas) {
        const volumeMap = calculateVolumePerExercise(entries);
        const exs = Object.keys(volumeMap).sort();
        const volumes = exs.map((ex) => volumeMap[ex]);
        // Set CSS size so drawBarChart() can calculate the internal
        // resolution based on device pixel ratio.  We avoid setting
        // canvas.width directly to preserve crisp rendering.
        volCanvas.style.width = `${Math.max(400, exs.length * 80)}px`;
        volCanvas.style.height = '300px';
        drawBarChart(volCanvas, exs, volumes);
      }
      const entriesByExercise = {};
      entries.forEach((e) => {
        if (!entriesByExercise[e.exercise]) entriesByExercise[e.exercise] = [];
        entriesByExercise[e.exercise].push(e);
      });
      Object.keys(entriesByExercise).forEach((ex) => {
        const canvas = document.getElementById(`line-chart-${ex}`);
        if (canvas) {
          const data = entriesByExercise[ex].slice().sort((a, b) => new Date(a.date) - new Date(b.date));
          const labels = data.map((d) => d.date);
          const weights = data.map((d) => Number(d.weight));
          const reps = data.map((d) => Number(d.reps));
          canvas.style.width = `${Math.max(400, labels.length * 60)}px`;
          canvas.style.height = '300px';
          drawLineChart(canvas, labels, weights, reps, ex);
        }
      });
    }, 0);
  }
  // Build header with title and total workouts
  const totalWorkouts = entries.length;
  const header = React.createElement(
    'header',
    { className: 'app-header' },
    React.createElement('h1', { className: 'app-title' }, '💪 Workout Tracker'),
    React.createElement(
      'div',
      { className: 'app-stats' },
      React.createElement('span', { className: 'stat-label' }, 'Total Workouts:'),
      React.createElement('span', { className: 'stat-value' }, String(totalWorkouts))
    )
  );
  // Build navigation bar using tab style
  const navBar = React.createElement(
    'nav',
    { className: 'tab-nav' },
    React.createElement(
      'button',
      {
        className: view === 'log' ? 'tab-btn active' : 'tab-btn',
        onClick: () => {
          setView('log');
          trackClarity('log');
        },
      },
      'Log'
    ),
    React.createElement(
      'button',
      {
        className: view === 'plan' ? 'tab-btn active' : 'tab-btn',
        onClick: () => {
          setView('plan');
          trackClarity('plan');
        },
      },
      'Plan'
    ),
    React.createElement(
      'button',
      {
        className: view === 'progress' ? 'tab-btn active' : 'tab-btn',
        onClick: () => {
          setView('progress');
          trackClarity('progress');
        },
      },
      'Progress'
    )
  );
  // Build log page content
  let content;
  if (view === 'log') {
    const rows = [];
    if (entries && entries.length > 0) {
      const tableRows = entries.map((entry) =>
        React.createElement(
          'tr',
          { key: entry.id },
          React.createElement('td', null, entry.date),
          React.createElement('td', null, entry.exercise),
          React.createElement('td', null, entry.weight),
          React.createElement('td', null, entry.reps),
          React.createElement('td', null, entry.notes)
        )
      );
      rows.push(
        React.createElement(
          'table',
          { className: 'entries-table', key: 'table' },
          React.createElement(
            'thead',
            null,
            React.createElement(
              'tr',
              null,
              React.createElement('th', null, 'Date'),
              React.createElement('th', null, 'Exercise'),
              React.createElement('th', null, 'Weight'),
              React.createElement('th', null, 'Reps'),
              React.createElement('th', null, 'Notes')
            )
          ),
          React.createElement('tbody', null, tableRows)
        )
      );
    }
    // Determine whether to show group form or individual form
    const formElements = [];
    formElements.push(
      React.createElement('h2', { key: 'title' }, 'Log Workout')
    );
    if (logMessage) {
      formElements.push(
        React.createElement(
          'div',
          { key: 'msg', className: `alert alert-${logMessageType === 'error' ? 'error' : 'success'}` },
          logMessage
        )
      );
    }
    // Date field
    formElements.push(
      React.createElement(
        'div',
        { className: 'form-group', key: 'log-date' },
        React.createElement('label', { htmlFor: 'log-date-input' }, 'Date'),
        React.createElement('input', {
          type: 'date',
          id: 'log-date-input',
          value: logDate,
          max: plan && plan.endDate ? plan.endDate : undefined,
          onInput: (e) => setLogDate(e.target.value),
        })
      )
    );
    if (scheduledExercises && scheduledExercises.length > 0) {
      // Group logging form
      formElements.push(
        React.createElement(
          'form',
          { onSubmit: handleGroupSubmit, key: 'group-form' },
          React.createElement('p', null, 'Planned exercises for ', logDate, ':'),
          scheduledExercises.map((ex) =>
            React.createElement(
              'div',
              { className: 'form-group', key: `group-${ex}` },
              React.createElement('label', null, ex),
              React.createElement('input', {
                type: 'number',
                placeholder: 'Weight',
                value: groupWeights[ex] || '',
                onInput: (ev) => setGroupWeights({ ...groupWeights, [ex]: ev.target.value }),
              }),
              React.createElement('input', {
                type: 'number',
                placeholder: 'Reps',
                value: groupReps[ex] || '',
                onInput: (ev) => setGroupReps({ ...groupReps, [ex]: ev.target.value }),
                style: { marginTop: '0.5rem' },
              })
            )
          ),
          React.createElement('button', { type: 'submit', className: 'btn' }, 'Log Planned Workouts')
        )
      );
    } else {
      // Individual logging form
      formElements.push(
        React.createElement(
          'form',
          { onSubmit: handleLogSubmit, key: 'ind-form' },
          // Exercise select with an option for "Other" and a custom input field
          React.createElement(
            'div',
            { className: 'form-group' },
            React.createElement('label', { htmlFor: 'log-ex-select' }, 'Exercise'),
            (() => {
              // Determine which option should be selected.  When the
              // user chooses "Other", we set showLogCustomInput to
              // true and do not select any predefined exercise.  When
              // showLogCustomInput is false, the current logExercise
              // determines the selected option.
              const selectedVal = showLogCustomInput ? '__other__' : (logExercise || '');
              return React.createElement(
                'select',
                {
                  id: 'log-ex-select',
                  onChange: (ev) => handleLogSelectChange(ev.target.value),
                  className: 'form-control',
                },
                // Placeholder option
                React.createElement('option', { value: '', selected: selectedVal === '' }, 'Select exercise'),
                // Predefined exercises
                datalistOptions.map((ex) =>
                  React.createElement('option', { value: ex, key: ex, selected: selectedVal === ex }, ex)
                ),
                // Other option
                React.createElement('option', { value: '__other__', selected: selectedVal === '__other__' }, 'Other')
              );
            })(),
            showLogCustomInput
              ? React.createElement('input', {
                  type: 'text',
                  id: 'log-ex-custom',
                  placeholder: 'New exercise',
                  value: logExercise,
                  onInput: (ev) => setLogExercise(ev.target.value),
                  style: { marginTop: '0.5rem' },
                })
              : null,
            React.createElement(
              'button',
              {
                type: 'button',
                className: 'btn',
                onClick: handleAddExerciseToBank,
                style: { marginTop: '0.5rem' },
              },
              'Add to Bank'
            )
          ),
          // Weight input
          React.createElement(
            'div',
            { className: 'form-group' },
            React.createElement('label', { htmlFor: 'log-w' }, 'Weight'),
            React.createElement('input', {
              type: 'number',
              step: 'any',
              id: 'log-w',
              value: logWeight,
              onInput: (ev) => setLogWeight(ev.target.value),
            })
          ),
          // Reps input
          React.createElement(
            'div',
            { className: 'form-group' },
            React.createElement('label', { htmlFor: 'log-r' }, 'Reps'),
            React.createElement('input', {
              type: 'number',
              id: 'log-r',
              value: logReps,
              onInput: (ev) => setLogReps(ev.target.value),
            })
          ),
          // Notes textarea
          React.createElement(
            'div',
            { className: 'form-group' },
            React.createElement('label', { htmlFor: 'log-notes' }, 'Notes (optional)'),
            React.createElement('textarea', {
              id: 'log-notes',
              rows: 2,
              value: logNotes,
              onInput: (ev) => setLogNotes(ev.target.value),
            })
          ),
          // Submit button
          React.createElement('button', { type: 'submit', className: 'btn' }, 'Log Workout')
        )
      );
    }
    content = React.createElement(
      'div',
      { className: 'card' },
      formElements,
      rows
    );
  } else if (view === 'plan') {
    const upcoming = getUpcomingSchedule();
    const planElements = [];
    planElements.push(React.createElement('h2', { key: 'title' }, 'Weekly Plan'));
    if (planMessage) {
      planElements.push(
        React.createElement(
          'div',
          { key: 'msg', className: `alert alert-${planMessageType === 'error' ? 'error' : 'success'}` },
          planMessage
        )
      );
    }
    if (plan) {
      planElements.push(
        React.createElement(
          'div',
          { key: 'summary' },
          React.createElement('p', null, 'Current plan active from ', plan.startDate, ' to ', plan.endDate),
          upcoming.length > 0
            ? React.createElement(
                'div',
                null,
                React.createElement('p', null, 'Upcoming 7 days:'),
                upcoming.map((item) =>
                  React.createElement(
                    'div',
                    { key: item.date },
                    React.createElement('strong', null, item.date),
                    ': ',
                    item.exercises.join(', ')
                  )
                )
              )
            : React.createElement('p', null, 'No workouts scheduled in the next 7 days.'),
          React.createElement(
            'button',
            { className: 'btn', onClick: handleClearPlan, style: { marginTop: '0.5rem' } },
            'Clear Plan'
          ),
          React.createElement('hr', { style: { margin: '1rem 0' } })
        )
      );
    }
    // Plan creation form
    const dayCheckboxes = dayNames.map((name, idx) =>
      React.createElement(
        'div',
        { key: `plan-day-${idx}`, style: { display: 'flex', alignItems: 'center', marginBottom: '0.25rem' } },
        React.createElement('input', {
          type: 'checkbox',
          id: `plan-day-${idx}`,
          checked: !!planSelectedDays[idx],
          onChange: () => togglePlanDay(idx),
        }),
        React.createElement('label', { htmlFor: `plan-day-${idx}`, style: { marginLeft: '0.4rem' } }, name)
      )
    );
    // Inputs for selected days
    const selectedKeys = Object.entries(planSelectedDays)
      .filter(([k, v]) => v && !isNaN(Number(k)) && dayNames[Number(k)] !== undefined)
      .map(([k]) => k);
    // Build dynamic exercise rows for each selected day.  Each row
    // contains a select dropdown for choosing a predefined exercise or
    // "Other", an optional custom input field for new exercises and a
    // remove button.  A button is also provided to add additional
    // exercise rows for the day.
    const exercisesInputs = selectedKeys.map((k) => {
      const list = planExercises[k] && Array.isArray(planExercises[k]) && planExercises[k].length > 0 ? planExercises[k] : [''];
      const rows = list.map((exVal, idx) => {
        // Compute the selected value.  An empty string indicates that
        // the user has chosen "Other" and will enter a custom exercise.
        const selectedVal = exVal === '' ? '__other__' : exVal;
        return React.createElement(
          'div',
          {
            key: `ex-row-${k}-${idx}`,
            style: { display: 'flex', alignItems: 'center', marginBottom: '0.5rem' },
          },
          // Exercise select element
          React.createElement(
            'select',
            {
              onChange: (ev) => handlePlanExerciseSelectChange(k, idx, ev.target.value),
              className: 'form-control',
              style: { flexGrow: 1 },
            },
            React.createElement('option', { value: '', selected: selectedVal === '' }, 'Select exercise'),
            datalistOptions.map((opt) =>
              React.createElement('option', {
                value: opt,
                key: `opt-${k}-${idx}-${opt}`,
                selected: selectedVal === opt,
              }, opt)
            ),
            React.createElement('option', { value: '__other__', selected: selectedVal === '__other__' }, 'Other')
          ),
          // Custom input field when "Other" is selected (empty string)
          exVal === ''
            ? React.createElement('input', {
                type: 'text',
                placeholder: 'New exercise',
                value: exVal || '',
                onInput: (ev) => handlePlanExerciseInputChange(k, idx, ev.target.value),
                style: { marginLeft: '0.5rem', flexGrow: 1 },
              })
            : null,
          // Remove button (only show if more than one exercise row exists)
          list.length > 1
            ? React.createElement(
                'button',
                {
                  type: 'button',
                  className: 'btn',
                  onClick: () => removePlanExerciseRow(k, idx),
                  style: { marginLeft: '0.5rem', padding: '0.25rem 0.5rem' },
                },
                'Remove'
              )
            : null
        );
      });
      // Button to add another exercise row
      rows.push(
        React.createElement(
          'button',
          {
            type: 'button',
            className: 'btn',
            onClick: () => addPlanExerciseRow(k),
            style: { marginTop: '0.25rem' },
          },
          'Add Exercise'
        )
      );
      return React.createElement(
        'div',
        { className: 'form-group', key: `ex-group-${k}` },
        React.createElement(
          'label',
          null,
          'Exercises for ',
          dayNames[k]
        ),
        rows
      );
    });
    planElements.push(
      React.createElement(
        'form',
        { onSubmit: handleSavePlan, key: 'plan-form' },
        // Heading
        React.createElement('p', null, 'Create a new plan:'),
        // Day selection checkboxes
        React.createElement('div', { className: 'form-group' }, React.createElement('label', null, 'Select days'), dayCheckboxes),
        // Exercise inputs for selected days
        exercisesInputs,
        // Button to add exercises from plan to the exercise bank
        React.createElement(
          'button',
          {
            type: 'button',
            className: 'btn',
            onClick: handleAddPlanExercisesToBank,
            style: { marginBottom: '0.5rem' },
          },
          'Add Exercises to Bank'
        ),
        // End date input
        React.createElement(
          'div',
          { className: 'form-group' },
          React.createElement('label', { htmlFor: 'plan-end' }, 'End date'),
          React.createElement('input', {
            type: 'date',
            id: 'plan-end',
            value: planEndDate,
            min: formatDate(new Date()),
            onInput: (ev) => setPlanEndDate(ev.target.value),
          })
        ),
        // Submit button
        React.createElement('button', { type: 'submit', className: 'btn' }, 'Save Plan')
      )
    );
    content = React.createElement('div', { className: 'card' }, planElements);
  } else {
    // Progress page
    const avg = calculateGlobalAverages(entries);
    const prs = calculatePRs(entries);
    const volumeMap = calculateVolumePerExercise(entries);
    const exs = Object.keys(volumeMap).sort();
    // Build the progress section differently: show an export button,
    // statistics grid, a volume chart and individual line charts for
    // each exercise.  When there is no data, display a simple message.
    if (entries && entries.length > 0) {
      // Build personal records list.  Each record shows max weight,
      // max reps and max volume for an exercise.
      const prList = prs.map((item) =>
        React.createElement(
          'div',
          { className: 'pr-item', key: `pr-${item.exercise}` },
          React.createElement('div', { className: 'pr-exercise' }, item.exercise),
          React.createElement(
            'div',
            { className: 'pr-records' },
            React.createElement(
              'div',
              { className: 'pr-record' },
              React.createElement('span', { className: 'pr-record-label' }, 'Max Weight'),
              React.createElement('span', { className: 'pr-record-value' }, `${item.maxWeight}`)
            ),
            React.createElement(
              'div',
              { className: 'pr-record' },
              React.createElement('span', { className: 'pr-record-label' }, 'Max Reps'),
              React.createElement('span', { className: 'pr-record-value' }, `${item.maxReps}`)
            ),
            React.createElement(
              'div',
              { className: 'pr-record' },
              React.createElement('span', { className: 'pr-record-label' }, 'Max Volume'),
              React.createElement(
                'span',
                { className: 'pr-record-value' },
                `${(item.maxWeight * item.maxReps).toFixed(1)}`
              )
            )
          )
        )
      );
      // Build global averages display
      const avgDisplay = React.createElement(
        'div',
        { className: 'stat-display' },
        React.createElement(
          'div',
          { className: 'stat-item' },
          React.createElement('span', { className: 'stat-label' }, 'Average Weight:'),
          React.createElement('span', { className: 'stat-value' }, `${avg.averageWeight}`)
        ),
        React.createElement(
          'div',
          { className: 'stat-item' },
          React.createElement('span', { className: 'stat-label' }, 'Average Reps:'),
          React.createElement('span', { className: 'stat-value' }, `${avg.averageReps}`)
        )
      );
      // Build charts for each exercise
      const exerciseCharts = exs.map((ex) =>
        React.createElement(
          'div',
          { className: 'card', key: `card-${ex}` },
          React.createElement('h3', null, `${ex} Progress`),
          React.createElement(
            'div',
            { className: 'chart-container' },
            React.createElement('canvas', { id: `line-chart-${ex}` })
          )
        )
      );
      // Compose the content with a top heading, export button,
      // statistics grid, volume chart and per-exercise charts.
      content = React.createElement(
        'div',
        { className: 'card' },
        React.createElement('h2', null, 'Progress & Analytics'),
        React.createElement(
          'button',
          {
            className: 'btn btn--primary',
            onClick: () => exportCSV(entries),
            style: { marginBottom: '1rem' },
          },
          'Export CSV'
        ),
        // Stats grid with averages and personal records
        React.createElement(
          'div',
          { className: 'stats-grid' },
          React.createElement(
            'div',
            { className: 'stat-card' },
            React.createElement('h3', null, 'Global Averages'),
            avgDisplay
          ),
          React.createElement(
            'div',
            { className: 'stat-card' },
            React.createElement('h3', null, 'Personal Records'),
            prs && prs.length > 0
              ? React.createElement('div', { className: 'pr-list' }, prList)
              : React.createElement('p', { className: 'no-data-text' }, 'No personal records yet. Start lifting!')
          )
        ),
        // Volume bar chart (only if there are exercises)
        exs && exs.length > 0
          ? React.createElement(
              'div',
              { className: 'card' },
              React.createElement('h3', null, 'Total Volume per Exercise'),
              React.createElement(
                'div',
                { className: 'chart-container' },
                React.createElement('canvas', { id: 'volume-bar-chart' })
              )
            )
          : null,
        // Individual exercise charts
        exerciseCharts
      );
    } else {
      // No data yet
      content = React.createElement(
        'div',
        { className: 'card' },
        React.createElement('h2', null, 'Progress & Analytics'),
        React.createElement('p', null, 'No workout data available yet.')
      );
    }
  }
  // Compose the root element.  Include a header with a title and
  // basic statistics, followed by the tabbed navigation bar and
  // whichever page content is currently selected.
  return React.createElement('div', null, header, navBar, content);
}

// Mount application
document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('root');
  React.render(React.createElement(App), root);
});