import dotenv from "dotenv";
dotenv.config();

export default  {
	"28GYUQJ9Q": {
		tag: "28GYUQJ9Q",
		schedule: '0 */4 * * *',
		token: process.env.QUOTAGUARDSTATIC_TOKEN,
		proxy: process.env.QUOTAGUARDSTATIC_URL,
	},
	"C9Y29P8V": {
		tag: "C9Y29P8V",
		schedule: '1 */6 * * *',
		token: process.env.FIXIE_TOKEN,
		proxy: process.env.FIXIE_URL,
	},
	"YQ9JYR2Q": {
		tag: "YQ9JYR2Q",
		schedule: '2 */8 * * *',
		token: process.env.FIXIE_TOKEN,
		proxy: process.env.FIXIE_URL,
	},
	"2PQLCVJYC": {
		tag: "2PQLCVJYC",
		schedule: '3 */8 * * *',
		token: process.env.FIXIE_TOKEN,
		proxy: process.env.FIXIE_URL,
	},
	// Partner
	"2Q8RLQGJU": {
		tag: "2Q8RLQGJU",
		schedule: '4 */8 * * *',
		token: process.env.FIXIE_TOKEN,
		proxy: process.env.FIXIE_URL,
	},
	"2LGP82UGV": {
		tag: "2LGP82UGV",
		schedule: '5 */8 * * *',
		token: process.env.FIXIE_SOCKS_TOKEN,
		proxy: process.env.FIXIE_SOCKS_HOST,
		proxySocks: true,
	},
	// Ally
	"28YRVG90P": {
		tag: "28YRVG90P",
		schedule: '6 */12 * * *',
		token: process.env.QUOTAGUARDSTATIC_TOKEN,
		proxy: process.env.QUOTAGUARDSTATIC_URL,
	},
	"QCUJRG80": {
		tag: "QCUJRG80",
		schedule: '7 */12 * * *',
		token: process.env.FIXIE_TOKEN,
		proxy: process.env.FIXIE_URL,
	},
	// Mystic Esports
	"2QCJLC89C": {
		tag: "2QCJLC89C",
		schedule: '7 */24 * * *',
		token: process.env.FIXIE_TOKEN,
		proxy: process.env.FIXIE_URL,
	}
};