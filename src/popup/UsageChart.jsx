import React from 'react'
import { Line, Pie } from 'react-chartjs-2'
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    ArcElement,
    Tooltip,
    Legend,
} from 'chart.js'

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    ArcElement,
    Tooltip,
    Legend
)

export default function UsageChart({ labels = [], data = [], categories = {} }) {
    const lineData = {
        labels,
        datasets: [
            {
                label: 'Minutes',
                data: data.map((d) => Math.round(d / 60)),
                borderColor: 'rgba(99,102,241,0.9)',
                backgroundColor: 'rgba(139,92,246,0.25)',
                tension: 0.35,
                pointRadius: 3,
            },
        ],
    }

    const pieData = {
        labels: Object.keys(categories),
        datasets: [
            {
                data: Object.values(categories).map((m) => Math.round(m)),
                backgroundColor: [
                    '#6366F1',
                    '#F97316',
                    '#06B6D4',
                    '#10B981',
                    '#EF4444',
                    '#F59E0B',
                ],
            },
        ],
    }

    return (
        <div className="space-y-3">
            <div className="h-28">
                <Line data={lineData} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
            </div>
            <div className="h-32 flex items-center justify-center">
                <div className="w-36 h-28">
                    <Pie data={pieData} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10 } } } }} />
                </div>
            </div>
        </div>
    )
}
