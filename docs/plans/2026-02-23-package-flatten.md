# Package Structure Flattening Plan

**Goal**: Move from nested `/web` structure to flat root structure

## Current Structure
```
nexusnote/
├── package.json          (proxy, redirects to web/)
├── web/
│   ├── package.json      (real dependencies)
│   ├── node_modules/
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── ...
```

## Target Structure
```
nexusnote/
├── package.json          (all dependencies)
├── node_modules/
├── app/
├── components/
├── lib/
└── ...
```

## Steps

### 1. Merge package.json
- Copy all dependencies from `web/package.json` to root
- Copy all devDependencies
- Update scripts to remove `cd web &&`
- Keep `engines` config

### 2. Move directories
- `web/app` → `app/`
- `web/components` → `components/`
- `web/lib` → `lib/`
- `web/db` → `db/`
- `web/config` → `config/`
- `web/types` → `types/`
- `web/party` → `party/`
- `web/public` → `public/`
- `web/*.config.js` → root

### 3. Update path imports
- Update `tsconfig.json` paths (remove `@/*` mapping to `./`)
- Update any remaining `@/` references if needed

### 4. Clean up
- Delete `web/` directory
- Delete root `package.json` proxy scripts
- Update `.gitignore` if needed

### 5. Verify
- Run `pnpm install`
- Run `pnpm dev`
- Run `pnpm build`
- Run `pnpm lint` and `pnpm typecheck`
