// Order sets the marker color when a place belongs to more than one group.
export const categoryMarkerColors = [
  { category: "Churches & cathedrals", marker: "#facc15", pinClass: "text-yellow-400" },
  { category: "Arts & Culture", marker: "#10b981", pinClass: "text-emerald-500" },
  { category: "Architecture", marker: "#ea580c", pinClass: "text-orange-600" },
  { category: "Memorials", marker: "#8b5cf6", pinClass: "text-violet-500" },
  { category: "Public Spaces", marker: "#e11d48", pinClass: "text-rose-600" },
  { category: "Other places", marker: "#3FB1CE", pinClass: "text-[#3FB1CE]" },
] as const;
