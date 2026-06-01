<?php
/**
 * VolleyStat Live — API REST
 * URL : https://seme-et-tisse.fr/API/VolleyStatLive/api_volleystatlive.php
 *
 * Actions disponibles (param GET ?action=...):
 *   init            — crée les tables si elles n'existent pas
 *   list_models     — liste des modèles de jeu
 *   get_model       — détail d'un modèle (?id=N)
 *   save_model      — POST: créer/modifier un modèle
 *   delete_model    — supprimer (?id=N)
 *   list_matches    — liste des matchs (metadata)
 *   get_match       — état complet (?match_id=...)
 *   save_match      — POST: sauvegarder/mettre à jour un match (upsert)
 *   delete_match    — supprimer (?match_id=...)
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
// Empêche le cache navigateur sur toutes les réponses API
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ── Configuration BDD ─────────────────────────────────────────────────────────
// ⚠️  Ne pas committer ce fichier dans un dépôt public.
define('DB_HOST', '127.0.0.1');
define('DB_NAME', 'semee2289142_9rvn4p');
define('DB_USER', 'semee2289142_9rvn4p');
define('DB_PASS', 'MYSQLChoune@69');

// ── Connexion PDO (singleton) ─────────────────────────────────────────────────
function db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    }
    return $pdo;
}

// ── Helpers réponse ───────────────────────────────────────────────────────────
function ok(mixed $data, int $code = 200): never {
    http_response_code($code);
    echo json_encode(['success' => true, 'data' => $data], JSON_UNESCAPED_UNICODE);
    exit;
}

function err(string $msg, int $code = 400): never {
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

function body(): array {
    $raw = file_get_contents('php://input');
    return json_decode($raw, true) ?? [];
}

// ── Init tables ───────────────────────────────────────────────────────────────
function initTables(): array {
    $db = db();

    // Modèles de jeu (formations)
    $db->exec("CREATE TABLE IF NOT EXISTS vsl_models (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        name        VARCHAR(100)  NOT NULL,
        description TEXT,
        config_json LONGTEXT      NOT NULL COMMENT 'Roles par position pour 6 rotations',
        builtin     TINYINT(1)    DEFAULT 0 COMMENT '1 = modèle intégré non supprimable',
        created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
        updated_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_model_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // Matchs
    $db->exec("CREATE TABLE IF NOT EXISTS vsl_matches (
        id              INT AUTO_INCREMENT PRIMARY KEY,
        match_id        VARCHAR(64)   NOT NULL UNIQUE,
        team_home_name  VARCHAR(100),
        team_away_name  VARCHAR(100),
        score_home      SMALLINT      DEFAULT 0,
        score_away      SMALLINT      DEFAULT 0,
        current_set     TINYINT       DEFAULT 1,
        state_json      LONGTEXT      NOT NULL COMMENT 'MatchState complet sérialisé',
        created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
        updated_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // Insérer le modèle 5-1 classique s'il n'existe pas
    seed5x1Classic($db);

    return ['tables_created' => true, 'message' => 'DB initialisée'];
}

// ── Seed : modèle 5-1 classique ───────────────────────────────────────────────
// Toujours mis à jour via ON DUPLICATE KEY UPDATE pour refléter la dernière version.
function seed5x1Classic(PDO $db): void {

    // Rôles par position pour chaque rotation
    // S=setter, C=central, R=receiver, P=pointu
    $sideOutRoles = [
        // rot 0 : S=P1(B) C=P2(F) R=P3(F) P=P4(F) R=P5(B) C=P6(B)
        [1=>['setter'], 2=>['central','attacker_3'], 3=>['receiver','attacker_4'],
         4=>['pointu','attacker_2'], 5=>['receiver'], 6=>['central']],
        // rot 1 : C=P1(B) R=P2(F) P=P3(F) R=P4(F) C=P5(B) S=P6(B)
        [1=>['central'], 2=>['receiver','attacker_4'], 3=>['pointu','attacker_2'],
         4=>['receiver','attacker_4'], 5=>['central'], 6=>['setter']],
        // rot 2 : R=P1(B) P=P2(F) R=P3(F) C=P4(F) S=P5(B) C=P6(B)
        [1=>['receiver'], 2=>['pointu','attacker_2'], 3=>['receiver','attacker_4'],
         4=>['central','attacker_3'], 5=>['setter'], 6=>['central']],
        // rot 3 : P=P1(B) R=P2(F) C=P3(F) S=P4(F) C=P5(B) R=P6(B)
        [1=>['pointu'], 2=>['receiver','attacker_4'], 3=>['central','attacker_3'],
         4=>['setter'], 5=>['central'], 6=>['receiver']],
        // rot 4 : R=P1(B) C=P2(F) S=P3(F) C=P4(F) R=P5(B) P=P6(B)
        [1=>['receiver'], 2=>['central','attacker_3'], 3=>['setter'],
         4=>['central','attacker_3'], 5=>['receiver'], 6=>['pointu']],
        // rot 5 : C=P1(B) S=P2(F) C=P3(F) R=P4(F) P=P5(B) R=P6(B)
        [1=>['central'], 2=>['setter'], 3=>['central','attacker_3'],
         4=>['receiver','attacker_4'], 5=>['pointu'], 6=>['receiver']],
    ];

    // Positions SideOut précises (perspective HOME : y=0=filet, y=1=fond)
    // Pour AWAY : transform miroir (1-x, 1-y) appliqué côté client.
    // F=front row (filet), B=back row
    $sideOutPositions = [
        // rot 0 : S=P1(B) – setter back-right, court vers filet après réception
        [1=>['x'=>0.83,'y'=>0.73], 2=>['x'=>0.83,'y'=>0.16], 3=>['x'=>0.60,'y'=>0.50],
         4=>['x'=>0.17,'y'=>0.16], 5=>['x'=>0.22,'y'=>0.60], 6=>['x'=>0.50,'y'=>0.80]],
        // rot 1 : S=P6(B) – setter back-center
        [1=>['x'=>0.83,'y'=>0.78], 2=>['x'=>0.72,'y'=>0.52], 3=>['x'=>0.50,'y'=>0.16],
         4=>['x'=>0.28,'y'=>0.52], 5=>['x'=>0.17,'y'=>0.78], 6=>['x'=>0.50,'y'=>0.78]],
        // rot 2 : S=P5(B) – setter back-left
        [1=>['x'=>0.83,'y'=>0.62], 2=>['x'=>0.83,'y'=>0.16], 3=>['x'=>0.55,'y'=>0.50],
         4=>['x'=>0.17,'y'=>0.16], 5=>['x'=>0.17,'y'=>0.72], 6=>['x'=>0.50,'y'=>0.80]],
        // rot 3 : S=P4(F) – setter front-left, déjà au filet
        [1=>['x'=>0.83,'y'=>0.78], 2=>['x'=>0.68,'y'=>0.52], 3=>['x'=>0.50,'y'=>0.16],
         4=>['x'=>0.20,'y'=>0.12], 5=>['x'=>0.17,'y'=>0.78], 6=>['x'=>0.55,'y'=>0.62]],
        // rot 4 : S=P3(F) – setter front-center, déjà au filet
        [1=>['x'=>0.83,'y'=>0.62], 2=>['x'=>0.83,'y'=>0.16], 3=>['x'=>0.55,'y'=>0.12],
         4=>['x'=>0.17,'y'=>0.16], 5=>['x'=>0.32,'y'=>0.62], 6=>['x'=>0.50,'y'=>0.80]],
        // rot 5 : S=P2(F) – setter front-right, déjà au filet
        [1=>['x'=>0.83,'y'=>0.80], 2=>['x'=>0.83,'y'=>0.12], 3=>['x'=>0.50,'y'=>0.16],
         4=>['x'=>0.28,'y'=>0.52], 5=>['x'=>0.17,'y'=>0.80], 6=>['x'=>0.52,'y'=>0.62]],
    ];

    $config = [
        'sideOutRoles'     => $sideOutRoles,
        'sideOutPositions' => $sideOutPositions,
    ];

    // INSERT IGNORE : n'insère que si le modèle n'existe pas encore.
    // ⚠️  NE PAS mettre ON DUPLICATE KEY UPDATE config_json=... ici —
    //     cela écraserait les modifications utilisateur à chaque initDb().
    $stmt = $db->prepare(
        "INSERT IGNORE INTO vsl_models (name, description, config_json, builtin) VALUES (?,?,?,1)"
    );
    $stmt->execute([
        '5-1 Classique',
        'Formation 5-1 standard : 1 passeur, 1 pointu, 2 centraux, 2 réceptionneurs. '
        . 'Positions SideOut pré-calculées pour les 6 rotations.',
        json_encode($config, JSON_UNESCAPED_UNICODE),
    ]);
}

// ── Router ────────────────────────────────────────────────────────────────────
$action = trim($_GET['action'] ?? '');

try {

    switch ($action) {

        // ── Initialisation ────────────────────────────────────────────────────
        case 'init':
            ok(initTables());

        // ── Modèles ───────────────────────────────────────────────────────────
        case 'list_models': {
            $rows = db()->query(
                "SELECT id, name, description, builtin, config_json, created_at FROM vsl_models ORDER BY builtin DESC, name ASC"
            )->fetchAll();
            foreach ($rows as &$row) {
                $row['config'] = !empty($row['config_json']) ? json_decode($row['config_json'], true) : null;
                unset($row['config_json']);
            }
            unset($row);
            ok($rows);
        }

        case 'get_model': {
            $id = (int)($_GET['id'] ?? 0);
            if (!$id) err('Paramètre id manquant');
            $stmt = db()->prepare("SELECT * FROM vsl_models WHERE id = ?");
            $stmt->execute([$id]);
            $row = $stmt->fetch();
            if (!$row) err('Modèle introuvable', 404);
            $row['config'] = json_decode($row['config_json'], true);
            unset($row['config_json']);
            ok($row);
        }

        case 'save_model': {
            $b = body();
            if (empty($b['name'])) err('Champ name manquant');
            $db   = db();
            // config peut être null/absent → on stocke un objet vide
            $rawConfig = $b['config'] ?? null;
            $cfg = is_array($rawConfig) ? json_encode($rawConfig, JSON_UNESCAPED_UNICODE) : '{}';
            $desc = $b['description'] ?? '';
            if (!empty($b['id'])) {
                // Mise à jour — builtin=1 autorise la modification du contenu (seule la suppression reste bloquée)
                $stmt = $db->prepare("UPDATE vsl_models SET name=?, description=?, config_json=? WHERE id=?");
                $stmt->execute([$b['name'], $desc, $cfg, (int)$b['id']]);
                if ($stmt->rowCount() === 0) {
                    // Peut arriver si l'id n'existe pas ; on tente un INSERT de secours
                    $stmt2 = $db->prepare(
                        "INSERT INTO vsl_models (name, description, config_json)
                         VALUES (?,?,?)
                         ON DUPLICATE KEY UPDATE description=VALUES(description), config_json=VALUES(config_json)"
                    );
                    $stmt2->execute([$b['name'], $desc, $cfg]);
                    $newId = (int)$db->lastInsertId();
                    if (!$newId) {
                        $s = $db->prepare("SELECT id FROM vsl_models WHERE name = ? LIMIT 1");
                        $s->execute([$b['name']]);
                        $newId = (int)($s->fetchColumn() ?: 0);
                    }
                    ok(['id' => $newId, 'created' => true]);
                }
                ok(['id' => (int)$b['id'], 'updated' => true]);
            } else {
                $stmt = $db->prepare(
                    "INSERT INTO vsl_models (name, description, config_json)
                     VALUES (?,?,?)
                     ON DUPLICATE KEY UPDATE description=VALUES(description), config_json=VALUES(config_json)"
                );
                $stmt->execute([$b['name'], $desc, $cfg]);
                // lastInsertId() peut valoir 0 sur MariaDB quand ON DUPLICATE KEY UPDATE joue
                $id = (int)$db->lastInsertId();
                if (!$id) {
                    $s = $db->prepare("SELECT id FROM vsl_models WHERE name = ? LIMIT 1");
                    $s->execute([$b['name']]);
                    $id = (int)($s->fetchColumn() ?: 0);
                }
                ok(['id' => $id, 'created' => true]);
            }
        }

        case 'delete_model': {
            $id = (int)($_GET['id'] ?? 0);
            if (!$id) err('Paramètre id manquant');
            $stmt = db()->prepare("DELETE FROM vsl_models WHERE id=? AND builtin=0");
            $stmt->execute([$id]);
            ok(['deleted' => $stmt->rowCount() > 0]);
        }

        // ── Matchs ────────────────────────────────────────────────────────────
        case 'list_matches': {
            $rows = db()->query(
                "SELECT match_id, team_home_name, team_away_name,
                        score_home, score_away, current_set,
                        created_at, updated_at
                 FROM vsl_matches
                 ORDER BY updated_at DESC
                 LIMIT 100"
            )->fetchAll();
            ok($rows);
        }

        case 'get_match': {
            $mid = trim($_GET['match_id'] ?? '');
            if (!$mid) err('Paramètre match_id manquant');
            $stmt = db()->prepare("SELECT * FROM vsl_matches WHERE match_id = ?");
            $stmt->execute([$mid]);
            $row = $stmt->fetch();
            if (!$row) err('Match introuvable', 404);
            $row['state'] = json_decode($row['state_json'], true);
            unset($row['state_json']);
            ok($row);
        }

        case 'save_match': {
            $b = body();
            if (empty($b['matchId'])) err('Champ matchId manquant');
            $db  = db();
            $mid = $b['matchId'];
            // On accepte soit {matchId, state: {...}} soit tout l'objet MatchState directement
            $state = isset($b['state']) ? $b['state'] : $b;
            $stateJson = json_encode($state, JSON_UNESCAPED_UNICODE);

            $stmt = $db->prepare(
                "INSERT INTO vsl_matches
                    (match_id, team_home_name, team_away_name, score_home, score_away, current_set, state_json)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    team_home_name = VALUES(team_home_name),
                    team_away_name = VALUES(team_away_name),
                    score_home     = VALUES(score_home),
                    score_away     = VALUES(score_away),
                    current_set    = VALUES(current_set),
                    state_json     = VALUES(state_json),
                    updated_at     = CURRENT_TIMESTAMP"
            );
            $stmt->execute([
                $mid,
                $b['teamHomeName'] ?? ($state['teamHomeName'] ?? ''),
                $b['teamAwayName'] ?? ($state['teamAwayName'] ?? ''),
                $b['scoreHome']    ?? ($state['scoreHome']    ?? 0),
                $b['scoreAway']    ?? ($state['scoreAway']    ?? 0),
                $b['currentSet']   ?? ($state['currentSet']   ?? 1),
                $stateJson,
            ]);
            ok(['saved' => true, 'matchId' => $mid]);
        }

        case 'delete_match': {
            $mid = trim($_GET['match_id'] ?? '');
            if (!$mid) err('Paramètre match_id manquant');
            $stmt = db()->prepare("DELETE FROM vsl_matches WHERE match_id = ?");
            $stmt->execute([$mid]);
            ok(['deleted' => $stmt->rowCount() > 0]);
        }

        default:
            err('Action inconnue : ' . htmlspecialchars($action));
    }

} catch (Throwable $e) {
    err('Erreur serveur : ' . $e->getMessage(), 500);
}
