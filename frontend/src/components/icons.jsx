/** Tiny inline SVG icon set (stroke = currentColor) so we ship zero icon deps. */

const base = (size) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
})

export const LeafLogo = ({ size = 26 }) => (
  <svg {...base(size)}>
    <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
    <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
  </svg>
)

export const DashboardIcon = ({ size = 18 }) => (
  <svg {...base(size)}>
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="16" width="7" height="5" rx="1" />
  </svg>
)

export const PlusCircleIcon = ({ size = 18 }) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v8M8 12h8" />
  </svg>
)

export const BoxIcon = ({ size = 18 }) => (
  <svg {...base(size)}>
    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
    <path d="m3.3 7 8.7 5 8.7-5M12 22V12" />
  </svg>
)

export const UsersIcon = ({ size = 18 }) => (
  <svg {...base(size)}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)

export const UserIcon = ({ size = 18 }) => (
  <svg {...base(size)}>
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)

export const LogoutIcon = ({ size = 18 }) => (
  <svg {...base(size)}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5M21 12H9" />
  </svg>
)

export const MenuIcon = ({ size = 22 }) => (
  <svg {...base(size)}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
)

export const CloseIcon = ({ size = 20 }) => (
  <svg {...base(size)}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
)

export const SearchIcon = ({ size = 16 }) => (
  <svg {...base(size)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.35-4.35" />
  </svg>
)

export const EditIcon = ({ size = 15 }) => (
  <svg {...base(size)}>
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
  </svg>
)

export const TrashIcon = ({ size = 15 }) => (
  <svg {...base(size)}>
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
  </svg>
)

export const AlertIcon = ({ size = 18 }) => (
  <svg {...base(size)}>
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <path d="M12 9v4M12 17h.01" />
  </svg>
)

export const RefreshIcon = ({ size = 16 }) => (
  <svg {...base(size)}>
    <path d="M21 12a9 9 0 1 1-2.64-6.36L21 8" />
    <path d="M21 3v5h-5" />
  </svg>
)

export const CameraIcon = ({ size = 18 }) => (
  <svg {...base(size)}>
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
    <circle cx="12" cy="13" r="3" />
  </svg>
)

export const ReportIcon = ({ size = 18 }) => (
  <svg {...base(size)}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
    <path d="M14 2v6h6" />
    <path d="M16 13H8" />
    <path d="M16 17H8" />
    <path d="M10 9H8" />
  </svg>
)

export const DownloadIcon = ({ size = 15 }) => (
  <svg {...base(size)}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="m7 10 5 5 5-5M12 15V3" />
  </svg>
)

export const ThermometerIcon = ({ size = 18 }) => (
  <svg {...base(size)}>
    <path d="M14 4a2 2 0 0 0-4 0v9.35a4 4 0 1 0 4 0Z" />
  </svg>
)

export const GaugeIcon = ({ size = 18 }) => (
  <svg {...base(size)}>
    <path d="M12 14 13.5 9.5" />
    <path d="M20.5 15.5a9 9 0 1 0-17 0" />
  </svg>
)

export const SparkleIcon = ({ size = 18 }) => (
  <svg {...base(size)}>
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
  </svg>
)

export const ChartIcon = ({ size = 18 }) => (
  <svg {...base(size)}>
    <path d="M3 3v18h18" />
    <path d="M7 15v3M12 9v9M17 5v13" />
  </svg>
)

export const BellIcon = ({ size = 18 }) => (
  <svg {...base(size)}>
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
)

export const PulseIcon = ({ size = 18 }) => (
  <svg {...base(size)}>
    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
  </svg>
)

export const StarIcon = ({ size = 18 }) => (
  <svg {...base(size)}>
    <path d="M12 2 15.09 8.26 22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01Z" />
  </svg>
)

export const ListIcon = ({ size = 18 }) => (
  <svg {...base(size)}>
    <path d="M8 6h13M8 12h13M8 18h13" />
    <path d="M3 6h.01M3 12h.01M3 18h.01" />
  </svg>
)
