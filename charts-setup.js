// ErgoAI Posture Dashboard Chart Configuration using Chart.js

let timelineChart = null;
let donutChart = null;
let weeklyChart = null;

// Initial Mock data for weekly chart
const mockWeeklyLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const mockWeeklyData = [82, 75, 88, 62, 79, 92, 100]; // scores out of 100

// Initialize all charts
function initCharts() {
    initTimelineChart();
    initDonutChart();
    initWeeklyChart();
}

// 1. Timeline Chart (Spine Angle and Neck Flex over time)
function initTimelineChart() {
    const ctx = document.getElementById('timelineChart').getContext('2d');
    
    // Create gradient for spine
    const gradientSpine = ctx.createLinearGradient(0, 0, 0, 300);
    gradientSpine.addColorStop(0, 'rgba(99, 102, 241, 0.2)');
    gradientSpine.addColorStop(1, 'rgba(99, 102, 241, 0.01)');

    timelineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [], // Time strings e.g. "17:10:20"
            datasets: [
                {
                    label: 'Spine Angle (°)',
                    data: [],
                    borderColor: '#6366F1',
                    backgroundColor: gradientSpine,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    yAxisID: 'y'
                },
                {
                    label: 'Neck Flexion (%)',
                    data: [],
                    borderColor: '#06B6D4',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        font: { family: 'Plus Jakarta Sans', weight: '600' }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 8,
                        font: { family: 'Plus Jakarta Sans' }
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    min: -40,
                    max: 60,
                    title: {
                        display: true,
                        text: 'Spine Tilt Angle (degrees)'
                    },
                    ticks: { font: { family: 'Plus Jakarta Sans' } }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    min: 0,
                    max: 100,
                    grid: { drawOnChartArea: false }, // only want grid lines for left axis
                    title: {
                        display: true,
                        text: 'Neck Flexion (%)'
                    },
                    ticks: { font: { family: 'Plus Jakarta Sans' } }
                }
            }
        }
    });
}

// 2. Posture Distribution Donut Chart
function initDonutChart() {
    const ctx = document.getElementById('donutChart').getContext('2d');
    
    donutChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Straight Sitting', 'Slouched', 'Neck Forward', 'Leaning Side', 'Empty Chair'],
            datasets: [{
                data: [0, 0, 0, 0, 100], // Start with chair empty
                backgroundColor: [
                    '#10B981', // Straight (Success)
                    '#EF4444', // Slouched (Danger)
                    '#F59E0B', // Neck Forward (Warning)
                    '#06B6D4', // Leaning (Info)
                    '#94A3B8'  // Empty (Muted)
                ],
                borderWidth: 2,
                borderColor: '#FFFFFF',
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        padding: 15,
                        font: { family: 'Plus Jakarta Sans', weight: '600', size: 11 }
                    }
                }
            }
        }
    });
}

// 3. Weekly Ergo Score Bar Chart
function initWeeklyChart() {
    const ctx = document.getElementById('weeklyChart').getContext('2d');
    
    weeklyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: mockWeeklyLabels,
            datasets: [{
                label: 'Ergo Score',
                data: mockWeeklyData,
                backgroundColor: '#EEF2FF',
                borderColor: '#6366F1',
                borderWidth: 1.5,
                borderRadius: 8,
                hoverBackgroundColor: '#6366F1'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { font: { family: 'Plus Jakarta Sans', weight: '600' } }
                },
                y: {
                    min: 0,
                    max: 100,
                    ticks: { font: { family: 'Plus Jakarta Sans' } }
                }
            }
        }
    });
}

// Function to add a point to the timeline
function addTimelineData(timeStr, spineAngle, neckFlex) {
    if (!timelineChart) return;
    
    // Add new label and data point
    timelineChart.data.labels.push(timeStr);
    timelineChart.data.datasets[0].data.push(spineAngle);
    timelineChart.data.datasets[1].data.push(neckFlex);
    
    // Keep max 50 points to avoid chart congestion
    if (timelineChart.data.labels.length > 50) {
        timelineChart.data.labels.shift();
        timelineChart.data.datasets[0].data.shift();
        timelineChart.data.datasets[1].data.shift();
    }
    
    timelineChart.update('none'); // Update without animation for performance
}

// Function to update Donut distribution percentages
function updateDonutData(straightSecs, slouchedSecs, forwardSecs, leaningSecs, emptySecs) {
    if (!donutChart) return;
    
    const total = straightSecs + slouchedSecs + forwardSecs + leaningSecs + emptySecs;
    if (total === 0) return;
    
    const data = [
        ((straightSecs / total) * 100).toFixed(1),
        ((slouchedSecs / total) * 100).toFixed(1),
        ((forwardSecs / total) * 100).toFixed(1),
        ((leaningSecs / total) * 100).toFixed(1),
        ((emptySecs / total) * 100).toFixed(1)
    ];
    
    donutChart.data.datasets[0].data = data;
    donutChart.update();
}

// Function to update the weekly chart value for "Today"
function updateTodayWeeklyScore(score) {
    if (!weeklyChart) return;
    
    // Update the last bar (Sunday/Today)
    weeklyChart.data.datasets[0].data[6] = Math.round(score);
    weeklyChart.update();
}

// Initialize when page script loads
document.addEventListener('DOMContentLoaded', () => {
    initCharts();
});
