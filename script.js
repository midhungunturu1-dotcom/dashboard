let scatterChart = null;
let pieChart = null;
let barChart = null;

const fileInput = document.getElementById('fileInput');
const segmentButton = document.getElementById('segmentButton');
const messageBox = document.getElementById('messageBox');
const totalCustomersEl = document.getElementById('totalCustomers');
const averageIncomeEl = document.getElementById('averageIncome');
const averageScoreEl = document.getElementById('averageScore');
const segmentCountEl = document.getElementById('segmentCount');

segmentButton.addEventListener('click', () => {
  clearMessage();
  const file = fileInput.files[0];
  if (!file) {
    showMessage('Please select a CSV file to upload.', 'warning');
    return;
  }
  parseCsv(file);
});

function parseCsv(file) {
  showMessage('Parsing CSV file...', 'info');

  Papa.parse(file, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    complete: function (results) {
      if (results.errors && results.errors.length) {
        console.error(results.errors);
        showMessage('Failed to parse the CSV file. Please check the format.', 'danger');
        return;
      }

      const data = results.data
        .map((row) => {
          const normalized = normalizeRowKeys(row);
          return {
            Age: Number(normalized.age),
            Income: Number(normalized.income),
            SpendingScore: Number(
              normalized['spending score'] ?? normalized.spending_score ?? normalized.spendingscore ?? normalized.score
            ),
          };
        })
        .filter((row) => isFinite(row.Age) && isFinite(row.Income) && isFinite(row.SpendingScore));

      if (!data.length) {
        showMessage('CSV must contain numeric Age, Income, and Spending Score columns.', 'danger');
        return;
      }

      runClustering(data, 4);
    },
    error: function (error) {
      console.error(error);
      showMessage('Unable to read the file. Try a different CSV.', 'danger');
    },
  });
}

function normalizeRowKeys(row) {
  return Object.keys(row).reduce((result, key) => {
    result[key.trim().toLowerCase()] = row[key];
    return result;
  }, {});
}

function showMessage(text, type) {
  messageBox.innerHTML = `<div class="alert alert-${type} py-2">${text}</div>`;
}

function runClustering(data, segments) {
  const featureMatrix = data.map((row) => [row.Age, row.Income, row.SpendingScore]);
  const normalized = normalizeData(featureMatrix);

  const { labels, centers } = kmeans(normalized.scaled, segments, 100);
  const grouped = data.map((row, index) => ({ ...row, cluster: labels[index] }));

  const kpis = {
    total_customers: grouped.length,
    average_income: average(grouped.map((item) => item.Income)),
    average_spending_score: average(grouped.map((item) => item.SpendingScore)),
    number_of_segments: segments,
  };

  const distribution = Array.from({ length: segments }, (_, i) => ({
    segment: i + 1,
    count: grouped.filter((item) => item.cluster === i).length,
  }));

  const segmentSummary = Array.from({ length: segments }, (_, i) => {
    const clusterRows = grouped.filter((item) => item.cluster === i);
    return {
      segment: i + 1,
      count: clusterRows.length,
      average_income: average(clusterRows.map((item) => item.Income)),
      average_spending_score: average(clusterRows.map((item) => item.SpendingScore)),
      center: clusterRows.length
        ? {
            Income: average(clusterRows.map((item) => item.Income)),
            SpendingScore: average(clusterRows.map((item) => item.SpendingScore)),
          }
        : { Income: 0, SpendingScore: 0 },
    };
  });

  renderKpis(kpis);
  renderScatter(grouped, segmentSummary);
  renderPie(distribution);
  renderBar(segmentSummary);
  showMessage('Customer segmentation completed successfully.', 'success');
}

function normalizeData(data) {
  const dims = data[0].length;
  const mins = Array(dims).fill(Infinity);
  const maxs = Array(dims).fill(-Infinity);

  data.forEach((row) => {
    row.forEach((value, index) => {
      if (value < mins[index]) mins[index] = value;
      if (value > maxs[index]) maxs[index] = value;
    });
  });

  const scaled = data.map((row) =>
    row.map((value, index) => {
      const range = maxs[index] - mins[index];
      return range === 0 ? 0 : (value - mins[index]) / range;
    })
  );

  return { scaled, mins, maxs };
}

function kmeans(data, k, maxIterations) {
  const n = data.length;
  const dims = data[0].length;
  const centers = initializeCenters(data, k);
  const labels = new Array(n).fill(0);

  for (let iter = 0; iter < maxIterations; iter++) {
    let changed = false;

    for (let i = 0; i < n; i++) {
      const distances = centers.map((center) => squaredDistance(data[i], center));
      const closest = distances.indexOf(Math.min(...distances));
      if (labels[i] !== closest) {
        labels[i] = closest;
        changed = true;
      }
    }

    const sums = Array.from({ length: k }, () => Array(dims).fill(0));
    const counts = Array(k).fill(0);

    for (let i = 0; i < n; i++) {
      const label = labels[i];
      counts[label] += 1;
      for (let d = 0; d < dims; d += 1) {
        sums[label][d] += data[i][d];
      }
    }

    for (let j = 0; j < k; j++) {
      if (counts[j] === 0) {
        centers[j] = data[Math.floor(Math.random() * n)].slice();
      } else {
        for (let d = 0; d < dims; d += 1) {
          centers[j][d] = sums[j][d] / counts[j];
        }
      }
    }

    if (!changed) break;
  }

  return { labels, centers };
}

function initializeCenters(data, k) {
  const centers = [];
  const firstIndex = Math.floor(Math.random() * data.length);
  centers.push(data[firstIndex].slice());

  while (centers.length < k) {
    const distances = data.map((point) => {
      return Math.min(...centers.map((center) => squaredDistance(point, center)));
    });
    const totalDistance = distances.reduce((sum, value) => sum + value, 0);
    const threshold = Math.random() * totalDistance;
    let cumulative = 0;
    let chosenIndex = 0;

    for (let i = 0; i < distances.length; i += 1) {
      cumulative += distances[i];
      if (cumulative >= threshold) {
        chosenIndex = i;
        break;
      }
    }

    centers.push(data[chosenIndex].slice());
  }

  return centers;
}

function squaredDistance(a, b) {
  return a.reduce((sum, value, index) => sum + (value - b[index]) ** 2, 0);
}

function average(numbers) {
  if (!numbers.length) return 0;
  const valid = numbers.filter((value) => isFinite(value));
  if (!valid.length) return 0;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function renderKpis(kpis) {
  totalCustomersEl.textContent = kpis.total_customers.toLocaleString();
  averageIncomeEl.textContent = `$${kpis.average_income.toFixed(2)}`;
  averageScoreEl.textContent = kpis.average_spending_score.toFixed(2);
  segmentCountEl.textContent = kpis.number_of_segments;
}

function renderScatter(data, segmentSummary) {
  const colors = ['#2f80ed', '#f2994a', '#27ae60', '#9b51e0', '#eb5757', '#56ccf2'];
  if (scatterChart) scatterChart.destroy();

  const datasets = segmentSummary.map((summary, index) => ({
    label: `Segment ${summary.segment}`,
    data: data.filter((item) => item.cluster === index).map((item) => ({ x: item.Income, y: item.SpendingScore })),
    backgroundColor: colors[index % colors.length],
    borderColor: colors[index % colors.length],
    pointRadius: 6,
  }));

  const centroidData = segmentSummary.map((summary) => ({ x: summary.center.Income, y: summary.center.SpendingScore }));
  datasets.push({
    label: 'Cluster Centers',
    data: centroidData,
    backgroundColor: '#000000',
    borderColor: '#000000',
    pointStyle: 'cross',
    pointRadius: 10,
  });

  const ctx = document.getElementById('scatterChart').getContext('2d');
  scatterChart = new Chart(ctx, {
    type: 'scatter',
    data: { datasets },
    options: {
      responsive: true,
      plugins: {
        tooltip: { callbacks: { label: (context) => `Income: ${context.parsed.x}, Score: ${context.parsed.y}` } },
        legend: { position: 'top' },
      },
      scales: {
        x: { title: { display: true, text: 'Income' } },
        y: { title: { display: true, text: 'Spending Score' } },
      },
    },
  });
}

function renderPie(distribution) {
  if (pieChart) pieChart.destroy();
  const ctx = document.getElementById('pieChart').getContext('2d');

  pieChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: distribution.map((item) => `Segment ${item.segment}`),
      datasets: [{
        data: distribution.map((item) => item.count),
        backgroundColor: ['#2f80ed', '#f2994a', '#27ae60', '#9b51e0', '#eb5757', '#56ccf2'],
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } },
    },
  });
}

function renderBar(segmentSummary) {
  if (barChart) barChart.destroy();
  const ctx = document.getElementById('barChart').getContext('2d');

  barChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: segmentSummary.map((item) => `Segment ${item.segment}`),
      datasets: [{
        label: 'Avg Income',
        data: segmentSummary.map((item) => Number(item.average_income.toFixed(2))),
        backgroundColor: '#2f80ed',
        borderRadius: 8,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Income' },
        },
      },
    },
  });
}
