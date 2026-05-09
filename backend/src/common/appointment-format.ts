export const formatAppointmentDate = (dateString?: string): string => {
  if (!dateString) return "";

  const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, year, month, day] = match;
    return `${day}-${month}-${year.slice(-2)}`;
  }

  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return dateString;

  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = String(parsed.getFullYear()).slice(-2);

  return `${day}-${month}-${year}`;
};

export const formatAppointmentTime = (timeString?: string): string => {
  if (!timeString) return "";

  const parts = timeString.split(":");
  if (parts.length < 2) return timeString;

  const hours = Number.parseInt(parts[0], 10);
  const minutes = Number.parseInt(parts[1], 10);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return timeString;

  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;

  return `${hour12}:${String(minutes).padStart(2, "0")} ${period}`;
};
