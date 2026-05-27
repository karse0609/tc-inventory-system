/**
 * 한국어(English) 병기 라벨
 * @param {{ label: { ko: string, en: string }, as?: keyof JSX.IntrinsicElements, className?: string, enClassName?: string, compact?: boolean }} props
 * @param compact true: 한 줄 `한글(English)` / false(기본): 한글 위 + 작은 `(English)` 아래
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

  if (label.en) {
    return (
      <Tag className={`bilingual bilingual--stacked ${className}`.trim()}>
        <span className="bilingual__ko-line">{label.ko}</span>
        <span className={`bilingual__en-line ${enClassName}`.trim()}>({label.en})</span>
      </Tag>
    )
  }

  return <Tag className={className}>{label.ko}</Tag>
}
