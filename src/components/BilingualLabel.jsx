/**
 * 한국어(English) 병기 라벨
 * @param {{ label: { ko: string, en: string }, as?: keyof JSX.IntrinsicElements, className?: string, enClassName?: string }} props
 */
export default function BilingualLabel({
  label,
  as: Tag = 'span',
  className = '',
  enClassName = 'bilingual__en',
}) {
  if (!label?.ko) return null

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
