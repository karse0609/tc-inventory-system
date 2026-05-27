# TC TECH Inventory (React + Vite)

운송중·창고 재고·입고 처리 등을 다루는 웹앱입니다.

- **PC ↔ 모바일 데이터 공통 저장**: Vercel 배포 시 선택적으로 Upstash Redis + `/api/inventory`를 켤 수 있습니다. 자세한 설정은 [docs/REMOTE_SYNC.md](docs/REMOTE_SYNC.md) 참고.
- 환경 변수 예시: [.env.example](.env.example)

---

## React + Vite (템플릿 원문)

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
