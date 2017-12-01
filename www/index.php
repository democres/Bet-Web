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

    function GenerateToken($size = 12) {
		
        $charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_';
        $token = '';
        
        for ($i = 0 ; $i < $size ; $i++)
            $token .= $charset[rand(0, strlen($charset) - 1)];
        
        return $token;
    }

    session_start();
    if (!isset($_SESSION['session'])) $_SESSION['session'] = false;

    if (isset($_GET['ref'])) {

        if (!$_SESSION['session']) {

            $_SESSION['ref'] = $_GET['ref'];
            // SET REF COOKIE
            header('Location: /register');
        }
    }
    
    if (isset($_POST['keepalive'])) {
        
        $_SESSION = $_SESSION;
        if ($_SESSION['session']) {

            // $statement = $_PDO->prepare("INSERT INTO `active_tokens` (`_uid`, `token`) VALUES (:uid, :token) ON DUPLICATE KEY UPDATE `token` = VALUES(`token`)");
            // $statement->execute(array(':uid' => $_SESSION['session']['id'], ':token' => $_SESSION['session']['token']));
        }
        exit();
    } else {

        if ($_SESSION['session']) {
            
            $statement = $_PDO->prepare("INSERT INTO `active_tokens` (`_uid`, `token`) VALUES (:uid, :token) ON DUPLICATE KEY UPDATE `token` = VALUES(`token`)");
            $statement->execute(array(':uid' => $_SESSION['session']['id'], ':token' => $_SESSION['session']['token']));
        }
    }

    if (isset($_GET['logout'])) {
        
        if ($_SESSION['session']) {

            $statement = $_PDO->prepare("DELETE FROM `active_tokens` WHERE `_uid` = :uid");
            $statement->execute(array(':uid' => $_SESSION['session']['id']));
        }
        session_destroy();
        header('Location: https://betting.reddev2.com/');
        exit();
    }

    if (isset($_GET['login'])) {
        
        if ($_SESSION['session']) {header('Location: https://betting.reddev2.com/'); exit();}
        if (isset($_POST['login-form'])) {
            
            if (isset($_POST['email']) && isset($_POST['password'])) {

                $err = [];
                                
                if (!preg_match('/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,6})+$/', $_POST['email']))
                    $err[] = 'email_invalid';

                if (!preg_match('/^[a-z0-9_-]{6,18}$/', $_POST['password']))
                    $err[] = 'password_invalid';
                
                if (count($err) == 0) {

                    $statement = $_PDO->prepare("SELECT * FROM `users` WHERE `email` = :email AND `password` = :password");
                    $statement->execute(array(':email' => $_POST['email'], ':password' => hash('sha256', sha1($_POST['password']))));
                    
                    if ($statement->rowCount() == 0)
                        $err[] = 'user_not_found';
                    
                    else {
                        
                        $user = $statement->fetch();
                        $_SESSION['session'] = array(
                            'id' => $user['id'],
                            'username' => $user['username'],
                            'email' => $user['email'],
                            'account_type' => $user['account_type'],
                            'token' => md5($user['email'] . $_SERVER['REMOTE_ADDR'] . session_id()),
                            'referral_token' => $user['referral_token']
                        );

                        $statement = $_PDO->prepare("INSERT INTO `active_tokens` (`_uid`, `token`) VALUES (:uid, :token) ON DUPLICATE KEY UPDATE `token` = VALUES(`token`)");
                        $statement->execute(array(':uid' => $_SESSION['session']['id'], ':token' => $_SESSION['session']['token']));

                        header('Location: https://betting.reddev2.com/');
                        exit();
                    }
                }
            }
        }
    }
    
    if (isset($_GET['register'])) {
        
        if ($_SESSION['session']) {header('Location: https://betting.reddev2.com/'); exit();}
        if (isset($_POST['register-form'])) {

            if (isset($_POST['email']) && isset($_POST['password']) && isset($_POST['password-c']) && isset($_POST['username'])) {

                $err = [];
                $statement = $_PDO->prepare("SELECT * FROM `users` WHERE `username` = :username");
                $statement->execute(array(':username' => $_POST['username']));
                
                if ($statement->rowCount() > 0)
                    $err[] = 'username_used';

                if (!preg_match('/^[A-Za-z0-9]+(?:[ _-][A-Za-z0-9]+)*$/', $_POST['username']))
                    $err[] = 'username_invalid';

                $statement = $_PDO->prepare("SELECT * FROM `users` WHERE `email` = :email");
                $statement->execute(array(':email' => $_POST['email']));

                if ($statement->rowCount() > 0)
                    $err[] = 'email_used';

                if (!preg_match('/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,6})+$/', $_POST['email']))
                    $err[] = 'email_invalid';

                if (!preg_match('/^[a-zA-Z0-9_-]{6,18}$/', $_POST['password']))
                    $err[] = 'password_invalid';

                if ($_POST['password'] != $_POST['password-c'])
                    $err[] = 'password_missmatch';
                
                do {
                
                    $referral_token = GenerateToken();

                    $statement = $_PDO->prepare("SELECT * FROM `users` WHERE `referral_token` = :referral_token");
                    $statement->execute(array(':referral_token' => $referral_token));
                } while ($statement->rowCount() > 0);

                if (count($err) == 0) {

                    if (isset($_SESSION['ref'])) {

                        $statement = $_PDO->prepare("SELECT * FROM `users` WHERE `referral_token` = :referral_token");
                        $statement->execute(array(':referral_token' => $_SESSION['ref']));
                        if ($statement->rowCount() > 0) $ref = $statement->fetch()['id'];
                    } else $ref = 0;
                    $statement = $_PDO->prepare("INSERT INTO `users` (`username`, `email`, `password`, `referral_token`, `referrer_uid`)
                                                    VALUES (:username, :email, :password, :referral_token, :referrer_uid)");
                    $statement->execute(
                        array(
                            ':username' => $_POST['username'],
                            ':email' => $_POST['email'],
                            ':password' => hash('sha256', sha1($_POST['password'])),
                            ':referral_token' => $referral_token,
                            ':referrer_uid' => $ref
                        )
                    );
                    
                    $statement = $_PDO->prepare("SELECT * FROM `users` WHERE `id` = :id");
                    $statement->execute(array(':id' => $_PDO->lastInsertId()));

                    $user = $statement->fetch();
                    $_SESSION['session'] = array(
                        'id' => $user['id'],
                        'username' => $user['username'],
                        'email' => $user['email'],
                        'account_type' => $user['account_type'],
                        'token' => md5($user['email'] . $_SERVER['REMOTE_ADDR'] . session_id()),
                        'referral_token' => $referral_token
                    );

                    $statement = $_PDO->prepare("INSERT INTO `active_tokens` (`_uid`, `token`) VALUES (:uid, :token) ON DUPLICATE KEY UPDATE `token` = VALUES(`token`)");
                    $statement->execute(array(':uid' => $_SESSION['session']['id'], ':token' => $_SESSION['session']['token']));

                    header('Location: https://betting.reddev2.com/');
                    exit();
                }
            } else {header('Location: https://betting.reddev2.com/'); exit();}
        }
    }
?>

<!DOCTYPE html>
<html>
    <head>
        <title>Betting</title>

        <link rel="stylesheet" href="//fonts.googleapis.com/css?family=Roboto|Roboto+Condensed:300,400,500,600" />
        <link rel="stylesheet" href="//api.reddev2.com/css/font-awesome.min.css" />
        <link rel="stylesheet" href="//api.reddev2.com/css/jquery.datetimepicker.min.css" />
        
        <link rel="stylesheet" href="/main.css" />
		
		<script src="//api.reddev2.com/js/jquery.min.js" defer></script>
		<?php if ($_SESSION['session']) echo '<script src="/main.js" defer></script>'; ?>
        <?php 
            
            if ($_SESSION['session']['account_type'] == 'ADMIN') {
                
                echo '<script src="//api.reddev2.com/js/jquery.datetimepicker.full.min.js" defer></script>';
                echo '<script src="/admin.js" defer></script>';
            }
        ?>
    </head>
    <body>
        <header>
            <div>
                <a href="/"><img src="/brand.png" class="logo" /></a>
                <div class="pull-right">
                    <?php
                        if (!$_SESSION['session']) {
                            
                            echo '
                                <a href="/login" id="login-button" class="btn btn-primary">Login</a>
                                <a href="/register" id="join-button" class="btn btn-actioncall">Join now</a>
                            ';
                        } else {

                            echo '
                                <a href="/">' . $_SESSION['session']['username'] . ' (' . $_SESSION['session']['email'] . ')</a>
                                <a href="/logout" id="logout-button" class="btn btn-secondary">Logout</a>
                            ';
                        }
                    ?>
                </div>
            </div>
        </header>
        
        <?php 

            if (isset($_GET['login'])) {
                
                $placeholder_email = 'Required';
                $placeholder_password = 'Required';

                if (isset($err)) {

                    if (in_array('user_not_found', $err)) {$placeholder_email = 'Invalid Credentials'; $placeholder_password = 'Invalid Credentials';}
                    if (in_array('email_invalid', $err)) $placeholder_email = 'Invalid Email';
                    if (in_array('password_invalid', $err)) $placeholder_password = 'Invalid Password';
                }
            ?>
                <section class="container">
                    <div class="small-container">
                        <form method="POST" action="/login">
                            <h2>Enter your credentials to Sign In</h2>
                            <div class="input-group">
                                <label for="email">Email Address</label>
                                <input type="mail" id="email" name="email" placeholder="<?php echo $placeholder_email; ?>" />
                            </div>
                            <div class="input-group">
                                <label for="password">Password</label>
                                <input type="password" id="password" name="password" placeholder="<?php echo $placeholder_password; ?>" />
                            </div>
                            <div class="input-group">
                                <input type="submit" id="login-form" name="login-form" value="Login" class="btn btn-primary" />
                            </div>
                        </form>
                    </div>
                </section>
        <?php }

            if (isset($_GET['register'])) {
                
                $placeholder_username = 'Required';
                $placeholder_email = 'Required';
                $placeholder_password = 'Required';
                $placeholder_password_c = 'Required';

                if (isset($err)) {

                    if (in_array('username_used', $err)) $placeholder_username = 'Username already in use';
                    if (in_array('username_invalid', $err)) $placeholder_username = 'Invalid Username';
                    if (in_array('email_used', $err)) $placeholder_email = 'Email address already in use';
                    if (in_array('email_invalid', $err)) $placeholder_email = 'Invalid Email';
                    if (in_array('password_invalid', $err)) $placeholder_password = 'Invalid Password';
                    if (in_array('password_missmatch', $err)) $placeholder_password_c = 'Passwords missmatch';
                }
            ?>
                <section class="container"> 
                    <div class="small-container">
                        <form method="POST" action="/register">
                            <h2>Create Your Account</h2>
                            <div class="input-group">
                                <label for="username">Username</label>
                                <input type="text" id="username" name="username" placeholder="<?php echo $placeholder_username; ?>" />
                            </div>
                            <div class="input-group">
                                <label for="email">Email Address</label>
                                <input type="mail" id="email" name="email" placeholder="<?php echo $placeholder_email; ?>" />
                            </div>
                            <div class="input-group">
                                <label for="password">Password</label>
                                <input type="password" id="password" name="password" placeholder="<?php echo $placeholder_password; ?>" />
                            </div>
                            <div class="input-group">
                                <label for="password-c">Re-Type Password</label>
                                <input type="password" id="password-c" name="password-c" placeholder="<?php echo $placeholder_password_c; ?>" />
                            </div>
                            <div class="input-group">
                                <input type="submit" id="register-form" name="register-form" value="Create Account" class="btn btn-actioncall" />
                            </div>
                        </form>
                    </div>
                </section>
        <?php }
                
            if ($_SESSION['session']) { ?>

                <section    id="client"
                            data-ref="<?php echo $_SESSION['session']['referral_token']; ?>"
                            data="<?php echo $_SESSION['session']['token']; ?>"<?php if ($_SESSION['session']['account_type'] == 'ADMIN') echo ' class="admin"';?>>
                    <ul id="left-panel">
                        <li id="balance"><span>Balance:</span><span></span></li>
                        <div id="events-list">
                            <div id="incoming">
                                <div class="title">Incoming</div>
                            </div>
                            <div id="ongoing">
                                <div class="title">Ongoing</div>
                            </div>
                            <div id="over" class="hide">
                                <div class="title">Waiting for results</div>
                            </div>
                        </div>
                        <?php if ($_SESSION['session']['account_type'] == 'ADMIN') echo '<li id="add-event">Add Event</li>'; ?>
                    </ul>
                    <div id="middle-panel"></div>
                    <div class="modal-outer">
                        <div class="modal-inner"></div>
                    </div>
                    <div class="notifications-wrapper"></div>
                </section>
        <?php } ?>
    </body>
</html>
