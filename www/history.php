<?php

ini_set('session.cookie_httponly', 1);
ini_set('session.cookie_secure', 1);

$_database_infos = array(

    'database' => 'mysql',
    'server' => array(
    
        'host' => 'localhost',
        'port' => '3306',
        'dbname' => 'betting'
    ),
    'credentials' => array(
    
        'username' => 'betting',
        'password' => 'betting'
    )
);

$_PDO = null;

try {
    
    $_PDO = new PDO(
    
        $_database_infos['database']
            . ':host=' . $_database_infos['server']['host']
            . ';port=' . $_database_infos['server']['port']
            . ';dbname=' . $_database_infos['server']['dbname'],
        $_database_infos['credentials']['username'],
        $_database_infos['credentials']['password']
    );
} catch (Exception $e) {header('HTTP/1.1 404'); exit();}


session_start();
if (!isset($_SESSION['session'])) $_SESSION['session'] = false;

    if(!empty($_SERVER['HTTP_X_REQUESTED_WITH']) && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) == 'xmlhttprequest') {
        
        if (!$_SESSION['session']) header('HTTP/1.0 404');
        else if (!isset($_POST['history'])) header('HTTP/1.0 404');
        else {

            switch($_POST['history']) {

                case 'referrals':

                    $statement = $_PDO->prepare("SELECT * FROM `users` WHERE `referrer_uid` = :ruid");
                    $statement->execute(array(':ruid' => $_SESSION['session']['id']));

                    $rows = $statement->fetchAll();
                    $r = array();

                    foreach($rows as $row) 
                        $r[] = array('username' => $row['username'], 'share' => 0);
                    

                    exit(json_encode($r));

                    break;

                case 'funds':
                    break;

                case 'transfer':
                    break;

                default: header('HTTP/1.0 404');
            }
        }
    } else header('Location: /');

?>
