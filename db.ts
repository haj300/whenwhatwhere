const { Pool } = require('pg');

const connect = () => {
    console.log("connecting to psql");
    return new Pool({
        user: process.env.PSQL_USER,
        host: process.env.PSQL_HOST,
        database: process.env.PSQL_DB,
        password: process.env.PSQL_PASSWORD,
        port: 5432
    });
}

const listTables = async (db) => {
    const res = await db.query('SELECT table_name FROM information_schema.tables WHERE table_schema=\'public\' AND table_type=\'BASE TABLE\'');
    return res.rows.map(row => row.table_name);
}

export { connect, listTables };