function parts(value: string) {
  const date = new Date(value);
  return {
    day: date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    time: date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

export function When({ value }: { value: string }) {
  const { day, time } = parts(value);
  return (
    <time className="when" dateTime={value}>
      <span>{day}</span>
      <span>{time}</span>
    </time>
  );
}

export function whenText(value: string) {
  const { day, time } = parts(value);
  return `${day} · ${time}`;
}
