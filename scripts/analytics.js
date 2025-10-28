import { db } from "./firebase.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

// Use date-fns library (loaded from HTML)
const { startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, parseISO, format } = dateFns;

// Chart instances
let salesChart = null;
let topItemsChart = null;
let reservationChart = null;

export async function loadAnalytics() {
    console.log("Attempting to load analytics data...");
    try {
        const [salesData, topItems, reservationData, lowStock] = await Promise.all([
            getSalesData(),
            getTopItems(),
            getReservationData(),
            getLowStockCount()
        ]);

        console.log("Data fetched:", { salesData, topItems, reservationData, lowStock });

        // --- 1. Render Stat Cards ---
        // Ensure elements exist before setting textContent
        const todaySalesEl = document.getElementById('analytics-today-sales');
        const weekSalesEl = document.getElementById('analytics-week-sales');
        const todayResEl = document.getElementById('analytics-today-res');
        const lowStockEl = document.getElementById('analytics-low-stock');

        if (todaySalesEl) todaySalesEl.textContent = `$${salesData.today.toFixed(2)}`;
        if (weekSalesEl) weekSalesEl.textContent = `$${salesData.thisWeek.toFixed(2)}`;
        if (todayResEl) todayResEl.textContent = reservationData.today;
        if (lowStockEl) lowStockEl.textContent = lowStock;


        // --- 2. Render Weekly Sales Chart ---
        const salesCanvas = document.getElementById('analytics-sales-chart');
        if (salesCanvas) {
            const salesCtx = salesCanvas.getContext('2d');
            if (salesChart) salesChart.destroy();
            salesChart = new Chart(salesCtx, {
                type: 'bar',
                data: {
                    labels: salesData.last7Days.labels,
                    datasets: [{
                        label: 'Daily Sales',
                        data: salesData.last7Days.data,
                        backgroundColor: 'rgba(28, 125, 74, 0.6)',
                        borderColor: 'rgba(28, 125, 74, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: { y: { beginAtZero: true } }
                }
            });
            console.log("Sales chart rendered.");
        } else {
            console.error("Sales chart canvas (#analytics-sales-chart) not found!");
        }


        // --- 3. Render Top Items Chart ---
        const itemsCanvas = document.getElementById('analytics-top-items-chart');
         if (itemsCanvas) {
            const itemsCtx = itemsCanvas.getContext('2d');
            if (topItemsChart) topItemsChart.destroy();
            // Only render chart if there's data
             if (topItems && topItems.labels && topItems.labels.length > 0) {
                 topItemsChart = new Chart(itemsCtx, {
                     type: 'doughnut',
                     data: {
                         labels: topItems.labels,
                         datasets: [{
                             label: 'Quantity Sold',
                             data: topItems.data,
                             backgroundColor: [
                                 'rgba(101, 85, 4, 0.7)',
                                 'rgba(28, 125, 74, 0.7)',
                                 'rgba(212, 184, 96, 0.7)',
                                 'rgba(75, 75, 75, 0.7)',
                                 'rgba(158, 158, 158, 0.7)'
                             ],
                             hoverOffset: 4
                         }]
                     },
                     options: {
                         responsive: true,
                         maintainAspectRatio: false
                     }
                 });
                 console.log("Top items chart rendered.");
             } else {
                  console.log("No top items data to render chart.");
                  // Optionally display a message on the canvas
                  itemsCtx.font = "16px Arial";
                  itemsCtx.textAlign = "center";
                  itemsCtx.fillText("No sales data for top items yet.", itemsCanvas.width / 2, itemsCanvas.height / 2);
             }
        } else {
             console.error("Top items chart canvas (#analytics-top-items-chart) not found!");
        }

        // --- 4. Render Reservation Chart ---
        const resCanvas = document.getElementById('analytics-reservation-chart');
        if (resCanvas) {
            const resCtx = resCanvas.getContext('2d');
            if (reservationChart) reservationChart.destroy();
             // Only render chart if there's data
             if (reservationData.pending > 0 || reservationData.completed > 0 || reservationData.canceled > 0) {
                 reservationChart = new Chart(resCtx, {
                     type: 'pie',
                     data: {
                         labels: ['Pending', 'Completed', 'Canceled'],
                         datasets: [{
                             data: [reservationData.pending, reservationData.completed, reservationData.canceled],
                             backgroundColor: [
                                 'rgba(255, 159, 64, 0.7)',
                                 'rgba(75, 192, 192, 0.7)',
                                 'rgba(255, 99, 132, 0.7)'
                             ],
                             hoverOffset: 4
                         }]
                     },
                     options: {
                         responsive: true,
                         maintainAspectRatio: false,
                         plugins: {
                             legend: {
                                 position: 'bottom',
                                 labels: { boxWidth: 12, padding: 10 }
                             }
                         }
                     }
                 });
                 console.log("Reservation chart rendered.");
            } else {
                 console.log("No reservation data to render chart.");
                  // Optionally display a message on the canvas
                 resCtx.font = "16px Arial";
                 resCtx.textAlign = "center";
                 resCtx.fillText("No reservation data yet.", resCanvas.width / 2, resCanvas.height / 2);
            }
        } else {
            console.error("Reservation chart canvas (#analytics-reservation-chart) not found!");
        }

    } catch (error) {
        console.error("Error loading analytics:", error);
    }
}


// --- Data Fetching Functions ---
async function getSalesData() {
    const transactionsRef = collection(db, "transactions");
    const snapshot = await getDocs(transactionsRef);
    const today = new Date();
    const todayStart = startOfDay(today);
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
    let todaySales = 0, thisWeekSales = 0, last7Days = {};
    for (let i = 0; i < 7; i++) {
        last7Days[format(subDays(today, i), 'yyyy-MM-dd')] = 0;
    }
    snapshot.forEach(doc => {
        const data = doc.data(); const total = data.total || 0;
        let timestamp = null;
        if (data.timestamp && typeof data.timestamp.toDate === 'function') {
            timestamp = data.timestamp.toDate();
        } else { return; }
        if (timestamp >= todayStart) todaySales += total;
        if (timestamp >= weekStart && timestamp <= weekEnd) thisWeekSales += total;
        const dayKey = format(timestamp, 'yyyy-MM-dd');
        if (last7Days.hasOwnProperty(dayKey)) last7Days[dayKey] += total;
    });
    const labels = Object.keys(last7Days).sort().map(day => format(parseISO(day), 'MMM d'));
    const data = Object.keys(last7Days).sort().map(day => last7Days[day]);
    return { today: todaySales, thisWeek: thisWeekSales, last7Days: { labels, data } };
}

async function getTopItems() {
    const transactionsRef = collection(db, "transactions");
    const snapshot = await getDocs(transactionsRef);
    let itemCounts = {};
    snapshot.forEach(doc => {
        (doc.data().items || []).forEach(item => {
            const name = item.name || "Unknown";
            // Ensure qty is a number, default to 1 if missing or invalid
            const qty = (typeof item.qty === 'number' && item.qty > 0) ? item.qty : 1;
            itemCounts[name] = (itemCounts[name] || 0) + qty;
        });
    });
    const top5 = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { labels: top5.map(item => item[0]), data: top5.map(item => item[1]) };
}

async function getReservationData() {
    const reservationsRef = collection(db, "reservations");
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const todayQuery = query(reservationsRef, where("date", "==", todayStr));
    const [snapshot, todaySnapshot] = await Promise.all([getDocs(reservationsRef), getDocs(todayQuery)]);
    let pending = 0, completed = 0, canceled = 0;
    snapshot.forEach(doc => {
        const status = doc.data().status;
        if (status === 'pending') pending++;
        else if (status === 'completed') completed++;
        else if (status === 'canceled') canceled++;
    });
    return { today: todaySnapshot.size, pending, completed, canceled };
}

async function getLowStockCount() {
    const inventoryRef = collection(db, "inventory");
    const lowStockQuery = query(inventoryRef, where("quantity", "<=", 10));
    const snapshot = await getDocs(lowStockQuery);
    return snapshot.size;
}