import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { search } from '../../api/search';
import { STATUS_COLORS } from '../../constants/colors';
import styles from './styles.module.css';

export default function Search() {
  const [searchParams] = useSearchParams();
  const q = searchParams.get('q') ?? '';

  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!q || q.length < 3) { setResults(null); return; }
    setLoading(true);
    setError('');
    search(q)
      .then(r => setResults(r.data.data))
      .catch(e => setError(e.response?.data?.message ?? 'Search failed'))
      .finally(() => setLoading(false));
  }, [q]);

  const total = results ? results.cases.length + results.documents.length + results.contacts.length : 0;

  return (
    <div>
      <h2 className={styles.heading}>Search Results</h2>
      {q && <p className={styles.sub}>Showing results for "<strong>{q}</strong>"</p>}

      {!q && <p className={styles.hint}>Enter at least 3 characters in the search bar above.</p>}
      {loading && <p>Searching…</p>}
      {error && <div className={styles.error}>{error}</div>}

      {results && !loading && (
        total === 0 ? (
          <div className={styles.empty}>No results found for "{q}".</div>
        ) : (
          <>
            {results.cases.length > 0 && (
              <section className={styles.group}>
                <div className={styles.groupHeader}>
                  <span className={styles.groupLabel}>Case Files</span>
                  <span className={styles.groupCount}>{results.cases.length}</span>
                </div>
                <div className={styles.list}>
                  {results.cases.map(c => (
                    <Link key={c.id} to={`/cases/${c.id}`} className={styles.item}>
                      <div className={styles.itemTitle}>{c.case_number}</div>
                      <div className={styles.itemMeta}>
                        {c.client_name}
                        {c.file_number && <> · {c.file_number}</>}
                        <span className={styles.badge} style={{ background: (STATUS_COLORS[c.status] ?? '#6b7280') + '20', color: STATUS_COLORS[c.status] ?? '#6b7280' }}>
                          {c.status}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {results.documents.length > 0 && (
              <section className={styles.group}>
                <div className={styles.groupHeader}>
                  <span className={styles.groupLabel}>Documents</span>
                  <span className={styles.groupCount}>{results.documents.length}</span>
                </div>
                <div className={styles.list}>
                  {results.documents.map(d => (
                    <Link key={d.id} to={`/documents/${d.id}`} className={styles.item}>
                      <div className={styles.itemTitle}>{d.title}</div>
                      <div className={styles.itemMeta}>
                        <span className={styles.badge} style={{ background: (STATUS_COLORS[d.status] ?? '#6b7280') + '20', color: STATUS_COLORS[d.status] ?? '#6b7280' }}>
                          {d.status.replace(/_/g, ' ')}
                        </span>
                        <span>{new Date(d.created_at).toLocaleDateString()}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {results.contacts.length > 0 && (
              <section className={styles.group}>
                <div className={styles.groupHeader}>
                  <span className={styles.groupLabel}>Contacts</span>
                  <span className={styles.groupCount}>{results.contacts.length}</span>
                </div>
                <div className={styles.list}>
                  {results.contacts.map(c => (
                    <Link key={c.id} to="/contacts" className={styles.item}>
                      <div className={styles.itemTitle}>{c.name}</div>
                      <div className={styles.itemMeta}>
                        {c.job_title}
                        {c.phone && <> · {c.phone}</>}
                        {c.email && <> · {c.email}</>}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        )
      )}
    </div>
  );
}
