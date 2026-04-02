import { useMemo } from "react";
import { Users, Clock, TrendingUp } from "lucide-react";
import eventHero from "@/assets/event-hero.jpg";
import { Registration } from "@/types/registration";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface AdminStatsProps {
  registrations: Registration[];
}

const COLORS = ["hsl(330, 81%, 60%)", "hsl(210, 100%, 50%)", "hsl(150, 60%, 50%)", "hsl(45, 90%, 50%)"];

const AdminStats = ({ registrations }: AdminStatsProps) => {
  const stats = useMemo(() => {
    const total = registrations.length;
    const avgAge = total ? Math.round(registrations.reduce((sum, r) => sum + r.age, 0) / total) : 0;
    const avgWeight = total ? Math.round(registrations.reduce((sum, r) => sum + r.weight, 0) / total) : 0;

    // Gender distribution
    const genderData = [
      { name: "Male", value: registrations.filter(r => r.gender === "Male").length },
      { name: "Female", value: registrations.filter(r => r.gender === "Female").length },
      { name: "Other", value: registrations.filter(r => r.gender === "Other").length },
    ].filter(d => d.value > 0);

    // Time slot distribution
    const timeSlotCounts: Record<string, number> = {};
    registrations.forEach(r => {
      timeSlotCounts[r.selectedTimeSlot] = (timeSlotCounts[r.selectedTimeSlot] || 0) + 1;
    });
    const timeSlotData = Object.entries(timeSlotCounts).map(([time, count]) => ({
      time,
      registrations: count,
    }));

    // Age distribution
    const ageRanges = [
      { range: "18-25", min: 18, max: 25 },
      { range: "26-35", min: 26, max: 35 },
      { range: "36-45", min: 36, max: 45 },
      { range: "46-55", min: 46, max: 55 },
      { range: "55+", min: 56, max: 150 },
    ];
    const ageData = ageRanges.map(({ range, min, max }) => ({
      range,
      count: registrations.filter(r => r.age >= min && r.age <= max).length,
    }));

    return { total, avgAge, avgWeight, genderData, timeSlotData, ageData };
  }, [registrations]);

  return (
    <div className="mb-6 space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Users className="w-5 h-5" />}
          label="Total Registrations"
          value={stats.total}
          color="primary"
        />
        <StatCard
          icon={
            <div className="w-5 h-5 rounded-full overflow-hidden border border-blue-100 shrink-0">
              <img src={eventHero} className="w-full h-full object-cover" alt="" />
            </div>
          }
          label="Average Age"
          value={`${stats.avgAge} yrs`}
          color="blue"
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="Average Weight"
          value={`${stats.avgWeight} kg`}
          color="green"
        />
        <StatCard
          icon={<Clock className="w-5 h-5" />}
          label="Time Slots"
          value={stats.timeSlotData.length}
          color="orange"
        />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Gender Distribution */}
        <div className="bg-card rounded-2xl border border-border p-5 shadow-card">
          <h3 className="font-semibold mb-4">Gender Distribution</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.genderData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {stats.genderData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Time Slot Distribution */}
        <div className="bg-card rounded-2xl border border-border p-5 shadow-card">
          <h3 className="font-semibold mb-4">Registrations by Time Slot</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.timeSlotData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis dataKey="time" type="category" width={70} fontSize={12} />
                <Tooltip />
                <Bar dataKey="registrations" fill="hsl(330, 81%, 60%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Age Distribution */}
        <div className="bg-card rounded-2xl border border-border p-5 shadow-card">
          <h3 className="font-semibold mb-4">Age Distribution</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.ageData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="range" fontSize={12} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(210, 100%, 50%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: "primary" | "blue" | "green" | "orange";
}

const StatCard = ({ icon, label, value, color }: StatCardProps) => {
  const colorClasses = {
    primary: "bg-primary/10 text-primary",
    blue: "bg-blue-500/10 text-blue-500",
    green: "bg-green-500/10 text-green-500",
    orange: "bg-orange-500/10 text-orange-500",
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-5 shadow-card">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${colorClasses[color]}`}>
        {icon}
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
};

export default AdminStats;
