CREATE VIRTUAL TABLE document_chunks_fts USING fts5(
	id UNINDEXED,
	document_id UNINDEXED,
	text,
	session_id UNINDEXED,
	content = 'document_chunks'
);

CREATE TRIGGER document_chunks_ai
AFTER
INSERT
	ON document_chunks BEGIN
INSERT INTO
	document_chunks_fts(id, document_id, text, session_id)
VALUES
	(
		new.id,
		new.document_id,
		new.text,
		new.session_id
	);

END;