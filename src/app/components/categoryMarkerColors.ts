// Order sets the marker color when a place belongs to more than one group.
export const categoryMarkerColors = [
  {
    category: "Churches & cathedrals",
    icon: "/icons/categories/religion.svg",
    marker: "#facc15",
    pinClass: "text-yellow-400",
  },
  {
    category: "Arts & Culture",
    icon: "/icons/categories/arts.svg",
    marker: "#10b981",
    pinClass: "text-emerald-500",
  },
  {
    category: "Architecture",
    icon: "/icons/categories/architecture.svg",
    marker: "#ea580c",
    pinClass: "text-orange-600",
  },
  {
    category: "Memorials",
    icon: "/icons/categories/memorials.svg",
    marker: "#8b5cf6",
    pinClass: "text-violet-500",
  },
  {
    category: "Public Spaces",
    icon: "/icons/categories/public.svg",
    marker: "#e11d48",
    pinClass: "text-rose-600",
  },
  {
    category: "Other places",
    icon: "/icons/categories/other.svg",
    marker: "#3FB1CE",
    pinClass: "text-[#3FB1CE]",
  },
] as const;
