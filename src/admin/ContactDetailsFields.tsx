import type { ContentData } from "../lib/types";
import styles from "./Admin.module.css";
export function ContactDetailsFields({data, onChange}: {data: ContentData; onChange: (patch: Partial<ContentData>) => void}) {
  return <>
    <h3>Контактные лица</h3>
    <p>Первый телефон в этом списке также показывается в подвале.</p>
    {data.contactPeople?.map((person, index) => <div key={index} className={styles.fields}>
      <label className={styles.field}>Имя<input aria-label={`Имя контактного лица ${index + 1}`} value={person.name} maxLength={160} onChange={event => onChange({contactPeople: data.contactPeople!.map((p, i) => i === index ? {...p, name: event.target.value} : p)})} /></label>
      <label className={styles.field}>Телефон<input aria-label={`Телефон контактного лица ${index + 1}`} value={person.phone} type="tel" maxLength={80} onChange={event => onChange({contactPeople: data.contactPeople!.map((p, i) => i === index ? {...p, phone: event.target.value} : p)})} /></label>
      <button type="button" onClick={() => onChange({contactPeople: data.contactPeople!.filter((_, i) => i !== index)})}>Убрать контактное лицо</button>
    </div>)}
    <button type="button" disabled={(data.contactPeople?.length || 0) >= 10} onClick={() => onChange({contactPeople: [...(data.contactPeople || []), {name: "", phone: ""}]})}>Добавить контактное лицо</button>
    <h3>Онлайн-площадки с изделиями</h3>
    {data.platforms?.map((platform, index) => <div className={styles.fields} key={index}>
      <label className={styles.field}>Название<input aria-label={`Название площадки ${index + 1}`} value={platform.label} maxLength={160} onChange={event => onChange({platforms: data.platforms!.map((p, i) => i === index ? {...p, label: event.target.value} : p)})} /></label>
      <label className={styles.field}>Описание<input aria-label={`Описание площадки ${index + 1}`} value={platform.description} maxLength={2000} onChange={event => onChange({platforms: data.platforms!.map((p, i) => i === index ? {...p, description: event.target.value} : p)})} /></label>
      <label className={styles.field}>Ссылка<input aria-label={`Ссылка площадки ${index + 1}`} value={platform.url} type="url" onChange={event => onChange({platforms: data.platforms!.map((p, i) => i === index ? {...p, url: event.target.value} : p)})} /></label>
      <button type="button" onClick={() => onChange({platforms: data.platforms!.filter((_, i) => i !== index)})}>Убрать площадку</button>
    </div>)}
    <button type="button" disabled={(data.platforms?.length || 0) >= 30} onClick={() => onChange({platforms: [...(data.platforms || []), {label: "", url: "", description: ""}]})}>Добавить площадку</button>
  </>;
}
