var _ = require('lodash');
var ejs = require('ejs');
var path = require('path');

var templatePath = path.resolve(__dirname, '../templates/index.html');

const acl = {
	'contributor': {
		users: [
			'User',
			'UserRole'
		],
		shared: [
			'PostCategory'
		],
		homepage: [
			'Benefit',
			'DesOverview'
		],
		about: [
			'AboutSection',
			'AboutPrinciple',
			'AboutFeature',
			'AboutProcessItem',
			'Skill'
		]
	}
};

module.exports = function IndexRoute (req, res) {
	var keystone = req.keystone;
	var lists = {};
	_.forEach(keystone.lists, function (list, key) {
		lists[key] = list.getOptions();
	});

	var UserList = keystone.list(keystone.get('user model'));
	const UserRole = keystone.list('UserRole');

	var orphanedLists = keystone.getOrphanedLists().map(function (list) {
		return _.pick(list, ['key', 'label', 'path']);
	});

	var backUrl = keystone.get('back url');
	if (backUrl === undefined) {
		// backUrl can be falsy, to disable the link altogether
		// but if it's undefined, default it to "/"
		backUrl = '/';
	}

	/* Restricting NAV */
	const user = req.user;

	keystone.roleNav = keystone.roleNav || {
		default: _.cloneDeep(keystone.nav)
	};

	if(user && user.role && !keystone.roleNav[user.role.key]) {
		keystone.roleNav[user.role.key] = _.cloneDeep(keystone.roleNav.default);
	}

	if(user && user.role && acl[user.role.key]) {
		console.log(`Restricting nav for ${user.role.key}`);

		const access = acl[user.role.key];

		/**
		 * Evaluate if section is accessible
		 * Section is accessible by default if there is no ACL entry for user.role.key
		 *
		 * @param {String} key
		 *
		 * @return {Boolean}
		 */
		function isSectionAccessible(key, access) {
			return !access || !access.includes(key);
		}

		function restrictNav(sections, access) {
			if(Array.isArray(sections) && access) {
				return sections
					.filter(section => isSectionAccessible(section.key, access));
			}

			return sections;
		}

		keystone.roleNav[user.role.key].sections
			.forEach(function(section, index, sections) {
				section.lists = restrictNav(section.lists, access[section.key])
				if(section.lists.length === 0) {
					sections.splice(sections.indexOf(section), 1);
				}
			});

		// // Removing restricted SECTIONS
		// Object.keys(keystone.nav.by.section).forEach(key => {
		// 	const section = keystone.nav.by.section[key];

		// 	if(section.lists && Array.isArray(section.lists)) {
		// 		section.lists = section.lists.filter(restrictNav);
		// 	}

		// 	if(!isSectionAccessible(section.key, access)) {
		// 		delete keystone.nav.by.section[key];
		// 	}
		// });

		// // Removing restricted LISTS
		// Object.keys(keystone.nav.by.list).forEach(listId => {
		// 	const section = keystone.nav.by.list[listId];

		// 	if(!isSectionAccessible(section.key, access)) {
		// 		delete keystone.nav.by.list[listId];
		// 	}
		// });
	}
	keystone.nav = keystone.roleNav[user.role.key];
	/* Restricting NAV */

	var keystoneData = {
		adminPath: '/' + keystone.get('admin path'),
		appversion: keystone.get('appversion'),
		backUrl: backUrl,
		brand: keystone.get('brand'),
		csrf: { header: {} },
		devMode: !!process.env.KEYSTONE_DEV,
		lists: lists,
		nav: keystone.nav,
		orphanedLists: orphanedLists,
		signoutUrl: keystone.get('signout url'),
		user: {
			id: req.user.id,
			name: UserList.getDocumentName(req.user) || '(no name)',
			role: req.user.role,
		},
		userList: UserList.key,
		version: keystone.version,
		wysiwyg: { options: {
			enableImages: keystone.get('wysiwyg images') ? true : false,
			enableCloudinaryUploads: keystone.get('wysiwyg cloudinary images') ? true : false,
			enableS3Uploads: keystone.get('wysiwyg s3 images') ? true : false,
			additionalButtons: keystone.get('wysiwyg additional buttons') || '',
			additionalPlugins: keystone.get('wysiwyg additional plugins') || '',
			additionalOptions: keystone.get('wysiwyg additional options') || {},
			overrideToolbar: keystone.get('wysiwyg override toolbar'),
			skin: keystone.get('wysiwyg skin') || 'keystone',
			menubar: keystone.get('wysiwyg menubar'),
			importcss: keystone.get('wysiwyg importcss') || '',
		} },
	};
	keystoneData.csrf.header[keystone.security.csrf.CSRF_HEADER_KEY] = keystone.security.csrf.getToken(req, res);

	var codemirrorPath = keystone.get('codemirror url path')
		? '/' + keystone.get('codemirror url path')
		: '/' + keystone.get('admin path') + '/js/lib/codemirror';

	var locals = {
		adminPath: keystoneData.adminPath,
		cloudinaryScript: false,
		codemirrorPath: codemirrorPath,
		env: keystone.get('env'),
		fieldTypes: keystone.fieldTypes,
		ga: {
			property: keystone.get('ga property'),
			domain: keystone.get('ga domain'),
		},
		keystone: keystoneData,
		title: keystone.get('name') || 'Keystone',
	};

	var cloudinaryConfig = keystone.get('cloudinary config');
	if (cloudinaryConfig) {
		var cloudinary = require('cloudinary');
		var cloudinaryUpload = cloudinary.uploader.direct_upload();
		keystoneData.cloudinary = {
			cloud_name: keystone.get('cloudinary config').cloud_name,
			api_key: keystone.get('cloudinary config').api_key,
			timestamp: cloudinaryUpload.hidden_fields.timestamp,
			signature: cloudinaryUpload.hidden_fields.signature,
		};
		locals.cloudinaryScript = cloudinary.cloudinary_js_config();
	};

	ejs.renderFile(templatePath, locals, {}, function (err, str) {
		if (err) {
			console.error('Could not render Admin UI Index Template:', err);
			return res.status(500).send(keystone.wrapHTMLError('Error Rendering Admin UI', err.message));
		}
		res.send(str);
	});
};
