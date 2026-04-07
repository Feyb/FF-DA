export function toMapById<T>(items: T[], key: keyof T & string): Record<string, T> {
  return items.reduce<Record<string, T>>((acc, item) => {
    acc[String(item[key])] = item;
    return acc;
  }, {});
}
