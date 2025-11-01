
import { db } from "./firebase.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

// Use date-fns library (loaded from HTML)
// Add a check in case dateFns hasn't loaded
if (typeof dateFns === 'undefined') {
  console.error("dateFns library is not loaded! Analytics will fail.");
  // You might want to stop execution or alert the user
}
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
        document.getElementById('analytics-today-sales').textContent = `$${salesData.today.toFixed(2)}`;
        document.getElementById('analytics-week-sales').textContent = `$${salesData.thisWeek.toFixed(2)}`;
        document.getElementById('analytics-today-res').textContent = reservationData.today;
        document.getElementById('analytics-low-stock').textContent = lowStock;

        // --- 2. Render Weekly Sales Chart ---
        const salesCanvas = document.getElementById('analytics-sales-chart');
        if (salesCanvas) { // Check if canvas exists
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
         if (itemsCanvas) { // Check if canvas exists
            const itemsCtx = itemsCanvas.getContext('2d');
            if (topItemsChart) topItemsChart.destroy();
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
             console.error("Top items chart canvas (#analytics-top-items-chart) not found!");
        }

        // --- 4. Render Reservation Chart ---
        const resCanvas = document.getElementById('analytics-reservation-chart');
        if (resCanvas) { // Check if canvas exists
            const resCtx = resCanvas.getContext('2d');
            if (reservationChart) reservationChart.destroy();
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
            console.error("Reservation chart canvas (#analytics-reservation-chart) not found!");
        }

    } catch (error) {
        console.error("Error loading analytics:", error);
    }
}


// --- Data Fetching Functions ---

async function getSalesData() {
    // 🔽 UPDATED: Pointed to "sales" collection
    const salesRef = collection(db, "sales");
    const snapshot = await getDocs(salesRef);
    
    const today = new Date();
    const todayStart = startOfDay(today);
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
    let todaySales = 0, thisWeekSales = 0, last7Days = {};
    
    for (let i = 0; i < 7; i++) {
        last7Days[format(subDays(today, i), 'yyyy-MM-dd')] = 0;
    }
    
    snapshot.forEach(doc => {
        const data = doc.data(); 
        // 🔽 UPDATED: Changed "total" to "totalAmount"
        const total = data.totalAmount || 0; 
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
    // 🔽 UPDATED: Pointed to "sales" collection
    const salesRef = collection(db, "sales");
    const snapshot = await getDocs(salesRef);
    let itemCounts = {};
    
    snapshot.forEach(doc => {
        (doc.data().items || []).forEach(item => {
            const name = item.name || "Unknown";
            // 🔽 UPDATED: Changed "qty" to "quantitySold"
            const qty = item.quantitySold || 1; 
            itemCounts[name] = (itemCounts[name] || 0) + qty;
        });
    });
    
    const top5 = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { labels: top5.map(item => item[0]), data: top5.map(item => item[1]) };
}

async function getReservationData() {
    // This function was already correct
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
    // 🔽 UPDATED: Pointed to "ingredients" collection
    const ingredientsRef = collection(db, "ingredients");
    const snapshot = await getDocs(ingredientsRef);
    
    let lowStockCount = 0;
    
    snapshot.forEach(doc => {
        const ing = doc.data();
        
        // Calculate current stock in base units
        const currentStockInBase = (ing.stockQuantity || 0) * (ing.conversionFactor || 1);
        const minStock = ing.minStockThreshold || 0;
        
        // Compare base unit stock to base unit threshold
        if (currentStockInBase <= minStock) {
            lowStockCount++;
        }
    });
    
    return lowStockCount;
}