export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { migrateOnStartup } = await import("./lib/migrate");
  await migrateOnStartup();
}
