const { mkdir, readFile, writeFile } = require("node:fs/promises");
const path = require("node:path");
const { Script } = require("node:vm");
const { transform } = require("esbuild");
const JavaScriptObfuscator = require("javascript-obfuscator");

const frontend = path.resolve(__dirname, "../../Supaclothes-frontend");
const staticRoot = path.resolve(__dirname, "../src/main/resources/static");
const stylesheets = ["css/inter.css", "css/estilos.css"];
const scripts = {
    "js/app.js": "a_",
    "js/receipt-pdf.js": "p_"
};
const copiedAssets = ["index.html", "favicon.svg", "js/vendor/jspdf.umd.min.js"];

async function minify(relativePath, loader) {
    const source = await readFile(path.join(frontend, relativePath), "utf8");
    const { code, warnings } = await transform(source, {
        loader,
        sourcefile: relativePath,
        minify: true,
        legalComments: "inline",
        treeShaking: false
    });
    for (const warning of warnings) console.warn(`${relativePath}: ${warning.text}`);
    return { sourceBytes: Buffer.byteLength(source), code };
}

async function build() {
    const assets = new Map();
    const sizes = [];
    for (const relativePath of copiedAssets) {
        assets.set(relativePath, await readFile(path.join(frontend, relativePath)));
    }
    for (const relativePath of stylesheets) {
        const { sourceBytes, code } = await minify(relativePath, "css");
        assets.set(relativePath, code);
        sizes.push({ archivo: relativePath, fuente: sourceBytes, minificado: Buffer.byteLength(code), salida: Buffer.byteLength(code) });
    }
    for (const [relativePath, identifiersPrefix] of Object.entries(scripts)) {
        const { sourceBytes, code } = await minify(relativePath, "js");
        const obfuscated = JavaScriptObfuscator.obfuscate(code, {
            target: "browser-no-eval",
            compact: true,
            seed: 1741,
            identifiersPrefix,
            identifierNamesGenerator: "mangled-shuffled",
            renameGlobals: true,
            // El HTML carga los dos scripts clásicos por separado.
            reservedNames: ["^makeReceiptPdf$"],
            stringArray: true,
            stringArrayCallsTransform: false,
            stringArrayRotate: false,
            stringArrayWrappersCount: 0,
            stringArrayThreshold: 0.5
        }).getObfuscatedCode();
        new Script(obfuscated, { filename: relativePath });
        assets.set(relativePath, obfuscated);
        sizes.push({ archivo: relativePath, fuente: sourceBytes, minificado: Buffer.byteLength(code), salida: Buffer.byteLength(obfuscated) });
    }

    // Completa y valida todas las transformaciones antes de escribir en static/.
    for (const [relativePath, content] of assets) {
        const destination = path.join(staticRoot, relativePath);
        await mkdir(path.dirname(destination), { recursive: true });
        await writeFile(destination, content);
    }
    console.table(sizes);
    console.log(`Web de producción generada en ${staticRoot}`);
}

build().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
