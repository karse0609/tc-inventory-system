# Forecast Upload (removed UI) — restore checklist

운영 단계에서는 상단 메뉴·라우트에서 제외되었습니다. Excel 일괄 반영을 다시 넣을 때 참고하세요.

1. **`src/utils/permissions.js`** — `VIEW_IDS`에 `'forecast'` 추가, `VIEW_LABELS`에 항목 추가 (`src/i18n/labels.js`).
2. **`src/App.jsx`** — `ForecastUploadPage` import 및 `view === 'forecast'` 분기 복구.
3. **페이지** — `src/components/pages/ForecastUploadPage.jsx` 재작성(삭제 전 버전은 Git 히스토리 참고).
4. **로직** — `parseProductExcel` / `ParseProductExcelError` (`parseGs30eExcel.js`), `buildForecastApplyPreview` (`forecastMerge.js`)는 유지됨.

현재 출고 수량은 **출고 계획** 화면에서 수기 입력 및 Excel 붙여넣기로 운영합니다.
