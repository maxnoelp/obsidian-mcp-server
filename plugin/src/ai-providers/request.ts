import * as https from "https";
import * as http from "http";

export function nodePost(url: string, headers: Record<string, string>, body: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const u = new URL(url);
		const isHttps = u.protocol === "https:";
		const lib = isHttps ? https : http;

		const req = lib.request(
			{
				hostname: u.hostname,
				port: u.port || (isHttps ? 443 : 80),
				path: u.pathname + u.search,
				method: "POST",
				headers: {
					...headers,
					"Content-Length": Buffer.byteLength(body),
				},
			},
			(res) => {
				let data = "";
				res.setEncoding("utf-8");
				res.on("data", (chunk) => (data += chunk));
				res.on("end", () => {
					if (res.statusCode && res.statusCode >= 400) {
						reject(new Error(`HTTP ${res.statusCode}: ${data}`));
					} else {
						resolve(data);
					}
				});
			}
		);
		req.on("error", reject);
		req.write(body);
		req.end();
	});
}
