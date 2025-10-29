const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const db = require('./config/database');

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.get('/', (req, res) => {
  const pesquisa = req.query.q;

  let sql = `
    SELECT c.ID, c.NOME, c.IDADE, GROUP_CONCAT(t.NUMERO SEPARATOR ', ') AS TELEFONES
    FROM Contato c
    LEFT JOIN Telefone t ON c.ID = t.IDCONTATO
  `;
  const params = [];

  if (pesquisa) {
    sql += ` WHERE c.NOME LIKE ? OR t.NUMERO LIKE ?`;
    params.push(`%${pesquisa}%`, `%${pesquisa}%`);
  }

  sql += ` GROUP BY c.ID`;

  db.query(sql, params, (err, contatos) => {
    if (err) throw err;
    res.render('index', { contatos, pesquisa });
  });
});

app.post('/contato', (req, res) => {
  const { nome, idade, telefones } = req.body;
  const listaTelefones = telefones.split(',').map(t => t.trim());

  db.query('INSERT INTO Contato (NOME, IDADE) VALUES (?, ?)', [nome, idade], (err, result) => {
    if (err) throw err;

    const contatoId = result.insertId;
    const valores = listaTelefones.map(t => [contatoId, t]);

    if (valores.length > 0) {
      db.query('INSERT INTO Telefone (IDCONTATO, NUMERO) VALUES ?', [valores], (err2) => {
        if (err2) throw err2;
        res.redirect('/');
      });
    } else {
      res.redirect('/');
    }
  });
});

app.post('/excluir/:id', (req, res) => {
  const { id } = req.params;

  db.query('SELECT NOME FROM Contato WHERE ID = ?', [id], (err, results) => {
    if (err) {
      console.error('Erro ao buscar contato para log:', err);
      return res.status(500).send('Erro interno ao buscar contato.');
    }

    const nomeContato = results.length > 0 ? results[0].NOME : 'Desconhecido';

    db.query('DELETE FROM Telefone WHERE IDCONTATO = ?', [id], (err2) => {
      if (err2) {
        console.error('Erro ao excluir telefones:', err2);
        return res.status(500).send('Erro ao excluir telefones.');
      }

      db.query('DELETE FROM Contato WHERE ID = ?', [id], (err3) => {
        if (err3) {
          console.error('Erro ao excluir contato:', err3);
          return res.status(500).send('Erro ao excluir contato.');
        }

        const dataHora = new Date().toLocaleString('pt-BR');
        const logMsg = `[${dataHora}] Contato excluído: ${nomeContato} (ID: ${id})\n`;

        fs.appendFile('log.txt', logMsg, (erroLog) => {
          if (erroLog) {
            console.error('Erro ao gravar log:', erroLog);
          } else {
            console.log(`📄 Log registrado: ${logMsg.trim()}`);
          }
        });

        res.redirect('/');
      });
    });
  });
});

app.post('/alterar/:id', (req, res) => {
  const { nome, idade, telefones } = req.body;
  const id = req.params.id;

  db.query('UPDATE Contato SET NOME=?, IDADE=? WHERE ID=?', [nome, idade, id], (err) => {
    if (err) throw err;

    db.query('DELETE FROM Telefone WHERE IDCONTATO=?', [id], (err2) => {
      if (err2) throw err2;

      const listaTelefones = telefones.split(',').map(t => t.trim());
      const valores = listaTelefones.map(t => [id, t]);

      if (valores.length > 0) {
        db.query('INSERT INTO Telefone (IDCONTATO, NUMERO) VALUES ?', [valores], (err3) => {
          if (err3) throw err3;
          res.redirect('/');
        });
      } else {
        res.redirect('/');
      }
    });
  });
});

const PORT = 3001;
app.listen(PORT, () => console.log(`🚀 Servidor rodando em http://localhost:${PORT}`));
