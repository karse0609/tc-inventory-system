/**
 * 한국어(English) 병기 라벨
 * @param {{ label: { ko: string, en: string }, as?: keyof JSX.IntrinsicElements, className?: string, enClassName?: string, compact?: boolean }} props
 * @param compact true이면 공백 없이 `한글(English)` 형식 (메뉴·버튼 등)
 */
export default function BilingualLabel({
  label,
  as: Tag = 'span',
  className = '',
  enClassName = 'bilingual__en',
  compact = false,
}) {
  if (!label?.ko) return null

  if (compact && label.en) {
    return (
      <Tag className={className}>
        {label.ko}
        <span className={enClassName}>({label.en})</span>
      </Tag>
    )
  }

  return (
    <Tag className={className}>
      {label.ko}
      {label.en ? (
        <>
          {' '}
          <span className={enClassName}>({label.en})</span>
        </>
      ) : null}
    </Tag>
  )
}
