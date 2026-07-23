export async function POST() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Clear-Site-Data": '"cache","cookies","storage"',
    },
  });
}
