import {
  Chart, BarController, BarElement, CategoryScale, Filler, Legend,
  LinearScale, LineController, LineElement, PointElement, Tooltip,
} from 'chart.js'

// Register only chart types used by this dashboard, once per module graph.
Chart.register(
  BarController, BarElement, CategoryScale, Filler, Legend,
  LinearScale, LineController, LineElement, PointElement, Tooltip,
)

export { Chart }
