export function check(result: { error: { message: string } | null }) {
  if (result.error) throw new Error(result.error.message);
}
