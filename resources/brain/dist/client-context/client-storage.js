"use strict";
/**
 * Client Storage Layer — Per-Client Filesystem Isolation
 *
 * Each client gets their own directory under data/clients/{clientId}/
 * containing JSON profile files and a SQLite chunks.db for document vectors.
 *
 * @author Barrios A2I
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientStorage = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const uuid_1 = require("uuid");
const logger_1 = require("../lib/logger");
const log = (0, logger_1.createChildLogger)('client');
// ============================================================================
// CLIENT STORAGE CLASS
// ============================================================================
class ClientStorage {
    baseDir;
    metaPath;
    constructor(baseDir) {
        const dataRoot = baseDir || process.env.CHROMADON_DATA_DIR || process.cwd();
        this.baseDir = path.join(dataRoot, 'data', 'clients');
        this.metaPath = path.join(this.baseDir, '_meta.json');
        if (!fs.existsSync(this.baseDir)) {
            fs.mkdirSync(this.baseDir, { recursive: true });
        }
        if (!fs.existsSync(this.metaPath)) {
            this.writeMeta({ activeClientId: null });
        }
        log.info(`[ClientStorage] Initialized: ${this.baseDir}`);
    }
    // =========================================================================
    // CLIENT LIFECYCLE
    // =========================================================================
    createClient(name) {
        const id = (0, uuid_1.v4)();
        const now = new Date().toISOString();
        const clientDir = this.getClientDir(id);
        fs.mkdirSync(clientDir, { recursive: true });
        fs.mkdirSync(path.join(clientDir, 'documents'), { recursive: true });
        fs.mkdirSync(path.join(clientDir, 'media'), { recursive: true });
        const info = {
            id,
            name,
            createdAt: now,
            lastActiveAt: now,
            interviewComplete: false,
            documentCount: 0,
            hasStrategy: false,
        };
        this.writeJson(clientDir, 'info.json', info);
        log.info(`[ClientStorage] Created client: ${name} (${id})`);
        return info;
    }
    getClient(clientId) {
        const clientDir = this.getClientDir(clientId);
        if (!fs.existsSync(clientDir))
            return null;
        return this.readJson(clientDir, 'info.json');
    }
    listClients() {
        if (!fs.existsSync(this.baseDir))
            return [];
        const entries = fs.readdirSync(this.baseDir, { withFileTypes: true });
        const clients = [];
        for (const entry of entries) {
            if (!entry.isDirectory() || entry.name.startsWith('_'))
                continue;
            const info = this.readJson(path.join(this.baseDir, entry.name), 'info.json');
            if (info)
                clients.push(info);
        }
        return clients.sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt));
    }
    deleteClient(clientId) {
        const clientDir = this.getClientDir(clientId);
        if (!fs.existsSync(clientDir))
            return false;
        fs.rmSync(clientDir, { recursive: true, force: true });
        const meta = this.readMeta();
        if (meta.activeClientId === clientId) {
            meta.activeClientId = null;
            this.writeMeta(meta);
        }
        log.info(`[ClientStorage] Deleted client: ${clientId}`);
        return true;
    }
    // =========================================================================
    // ACTIVE CLIENT
    // =========================================================================
    getActiveClientId() {
        const meta = this.readMeta();
        return meta.activeClientId;
    }
    setActiveClient(clientId) {
        const clientDir = this.getClientDir(clientId);
        if (!fs.existsSync(clientDir))
            return false;
        const meta = this.readMeta();
        meta.activeClientId = clientId;
        this.writeMeta(meta);
        this.touchClient(clientId);
        log.info(`[ClientStorage] Active client set: ${clientId}`);
        return true;
    }
    // =========================================================================
    // BUSINESS PROFILE
    // =========================================================================
    getProfile(clientId) {
        return this.readJson(this.getClientDir(clientId), 'profile.json');
    }
    updateProfile(clientId, profile) {
        const clientDir = this.getClientDir(clientId);
        const existing = this.readJson(clientDir, 'profile.json');
        const now = new Date().toISOString();
        const updated = {
            id: existing?.id || (0, uuid_1.v4)(),
            clientId,
            businessName: '',
            industry: '',
            businessType: '',
            yearFounded: 0,
            location: '',
            website: '',
            missionStatement: '',
            uniqueSellingPoints: [],
            products: [],
            services: [],
            goals: [],
            challenges: [],
            budget: '',
            timeline: '',
            createdAt: existing?.createdAt || now,
            updatedAt: now,
            ...existing,
            ...profile,
        };
        this.writeJson(clientDir, 'profile.json', updated);
        this.touchClient(clientId);
        return updated;
    }
    // =========================================================================
    // BRAND VOICE
    // =========================================================================
    getVoice(clientId) {
        return this.readJson(this.getClientDir(clientId), 'voice.json');
    }
    updateVoice(clientId, voice) {
        const clientDir = this.getClientDir(clientId);
        const existing = this.readJson(clientDir, 'voice.json');
        const now = new Date().toISOString();
        const updated = {
            clientId,
            tone: [],
            personality: [],
            avoidWords: [],
            examplePhrases: [],
            formalityLevel: 'neutral',
            writingStyle: '',
            hashtagStrategy: '',
            emojiUsage: 'minimal',
            callToActionStyle: '',
            updatedAt: now,
            ...existing,
            ...voice,
        };
        this.writeJson(clientDir, 'voice.json', updated);
        this.touchClient(clientId);
        return updated;
    }
    // =========================================================================
    // AUDIENCE PERSONAS
    // =========================================================================
    getPersonas(clientId) {
        return this.readJson(this.getClientDir(clientId), 'personas.json') || [];
    }
    addPersona(clientId, persona) {
        const personas = this.getPersonas(clientId);
        const now = new Date().toISOString();
        const newPersona = {
            id: (0, uuid_1.v4)(),
            clientId,
            createdAt: now,
            ...persona,
        };
        personas.push(newPersona);
        this.writeJson(this.getClientDir(clientId), 'personas.json', personas);
        this.touchClient(clientId);
        return newPersona;
    }
    updatePersonas(clientId, personas) {
        this.writeJson(this.getClientDir(clientId), 'personas.json', personas);
        this.touchClient(clientId);
    }
    // =========================================================================
    // COMPETITORS
    // =========================================================================
    getCompetitors(clientId) {
        return this.readJson(this.getClientDir(clientId), 'competitors.json') || [];
    }
    addCompetitor(clientId, competitor) {
        const competitors = this.getCompetitors(clientId);
        const now = new Date().toISOString();
        const newCompetitor = {
            id: (0, uuid_1.v4)(),
            clientId,
            createdAt: now,
            ...competitor,
        };
        competitors.push(newCompetitor);
        this.writeJson(this.getClientDir(clientId), 'competitors.json', competitors);
        this.touchClient(clientId);
        return newCompetitor;
    }
    updateCompetitors(clientId, competitors) {
        this.writeJson(this.getClientDir(clientId), 'competitors.json', competitors);
        this.touchClient(clientId);
    }
    // =========================================================================
    // GROWTH STRATEGY
    // =========================================================================
    getStrategy(clientId) {
        return this.readJson(this.getClientDir(clientId), 'strategy.json');
    }
    updateStrategy(clientId, strategy) {
        this.writeJson(this.getClientDir(clientId), 'strategy.json', strategy);
        const info = this.getClient(clientId);
        if (info) {
            info.hasStrategy = true;
            this.writeJson(this.getClientDir(clientId), 'info.json', info);
        }
        this.touchClient(clientId);
    }
    // =========================================================================
    // INTERVIEW STATE
    // =========================================================================
    getInterviewState(clientId) {
        return this.readJson(this.getClientDir(clientId), 'interview.json');
    }
    saveInterviewState(clientId, state) {
        state.lastActivityAt = new Date().toISOString();
        this.writeJson(this.getClientDir(clientId), 'interview.json', state);
        if (state.isComplete) {
            const info = this.getClient(clientId);
            if (info) {
                info.interviewComplete = true;
                this.writeJson(this.getClientDir(clientId), 'info.json', info);
            }
        }
        this.touchClient(clientId);
    }
    // =========================================================================
    // DOCUMENT TRACKING
    // =========================================================================
    getDocuments(clientId) {
        return this.readJson(this.getClientDir(clientId), 'documents.json') || [];
    }
    addDocument(clientId, doc) {
        const docs = this.getDocuments(clientId);
        docs.push(doc);
        this.writeJson(this.getClientDir(clientId), 'documents.json', docs);
        const info = this.getClient(clientId);
        if (info) {
            info.documentCount = docs.length;
            this.writeJson(this.getClientDir(clientId), 'info.json', info);
        }
        this.touchClient(clientId);
    }
    updateDocument(clientId, docId, updates) {
        const docs = this.getDocuments(clientId);
        const idx = docs.findIndex(d => d.id === docId);
        if (idx >= 0) {
            docs[idx] = { ...docs[idx], ...updates };
            this.writeJson(this.getClientDir(clientId), 'documents.json', docs);
        }
    }
    removeDocument(clientId, docId) {
        const docs = this.getDocuments(clientId);
        const filtered = docs.filter(d => d.id !== docId);
        if (filtered.length === docs.length)
            return false;
        this.writeJson(this.getClientDir(clientId), 'documents.json', filtered);
        const info = this.getClient(clientId);
        if (info) {
            info.documentCount = filtered.length;
            this.writeJson(this.getClientDir(clientId), 'info.json', info);
        }
        this.touchClient(clientId);
        return true;
    }
    getDocumentStoragePath(clientId) {
        return path.join(this.getClientDir(clientId), 'documents');
    }
    getChunksDbPath(clientId) {
        return path.join(this.getClientDir(clientId), 'chunks.db');
    }
    // =========================================================================
    // BRAND ASSETS (MEDIA VAULT)
    // =========================================================================
    getMediaAssets(clientId) {
        return this.readJson(this.getClientDir(clientId), 'media-assets.json') || [];
    }
    addMediaAsset(clientId, asset) {
        const assets = this.getMediaAssets(clientId);
        assets.push(asset);
        this.writeJson(this.getClientDir(clientId), 'media-assets.json', assets);
        this.touchClient(clientId);
    }
    removeMediaAsset(clientId, assetId) {
        const assets = this.getMediaAssets(clientId);
        const target = assets.find(a => a.id === assetId);
        if (!target)
            return false;
        const filtered = assets.filter(a => a.id !== assetId);
        this.writeJson(this.getClientDir(clientId), 'media-assets.json', filtered);
        // Delete the actual file
        try {
            if (fs.existsSync(target.storedPath)) {
                fs.unlinkSync(target.storedPath);
            }
        }
        catch { /* file may already be gone */ }
        this.touchClient(clientId);
        return true;
    }
    setPrimaryLogo(clientId, assetId) {
        const assets = this.getMediaAssets(clientId);
        const target = assets.find(a => a.id === assetId);
        if (!target)
            return false;
        for (const a of assets) {
            a.isPrimaryLogo = a.id === assetId;
        }
        this.writeJson(this.getClientDir(clientId), 'media-assets.json', assets);
        this.touchClient(clientId);
        return true;
    }
    getPrimaryLogo(clientId) {
        const assets = this.getMediaAssets(clientId);
        return assets.find(a => a.isPrimaryLogo) || null;
    }
    getMediaStoragePath(clientId) {
        const mediaDir = path.join(this.getClientDir(clientId), 'media');
        if (!fs.existsSync(mediaDir)) {
            fs.mkdirSync(mediaDir, { recursive: true });
        }
        return mediaDir;
    }
    // =========================================================================
    // FULL CONTEXT
    // =========================================================================
    getFullContext(clientId) {
        if (!this.getClient(clientId))
            return null;
        return {
            clientId,
            profile: this.getProfile(clientId),
            voice: this.getVoice(clientId),
            personas: this.getPersonas(clientId),
            competitors: this.getCompetitors(clientId),
            strategy: this.getStrategy(clientId),
            interviewState: this.getInterviewState(clientId),
            documents: this.getDocuments(clientId),
            mediaAssets: this.getMediaAssets(clientId),
        };
    }
    // =========================================================================
    // INTERNAL HELPERS
    // =========================================================================
    getClientDir(clientId) {
        return path.join(this.baseDir, clientId);
    }
    readJson(dir, filename) {
        const filePath = path.join(dir, filename);
        if (!fs.existsSync(filePath))
            return null;
        try {
            const raw = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(raw);
        }
        catch {
            return null;
        }
    }
    writeJson(dir, filename, data) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const filePath = path.join(dir, filename);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    }
    readMeta() {
        return this.readJson(this.baseDir, '_meta.json')
            || { activeClientId: null };
    }
    writeMeta(meta) {
        this.writeJson(this.baseDir, '_meta.json', meta);
    }
    touchClient(clientId) {
        const info = this.getClient(clientId);
        if (info) {
            info.lastActiveAt = new Date().toISOString();
            this.writeJson(this.getClientDir(clientId), 'info.json', info);
        }
    }
}
exports.ClientStorage = ClientStorage;
//# sourceMappingURL=client-storage.js.map