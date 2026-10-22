-- Collapse former station assignments without changing IDs, passwords or audit authors.
UPDATE users SET role = 'user'
WHERE role IN ('registration', 'triage', 'tb', 'seva', 'physiotherapy', 'consultation', 'pharmacy');
