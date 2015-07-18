var _ = require('underscore');
var React = require('react');
var Fields = require('../fields');
var InvalidFieldType = require('./InvalidFieldType');

var { Alert, Button, Modal } = require('elemental');

var Form = React.createClass({
	
	displayName: 'CreateForm',
	
	getDefaultProps: function() {
		return {
			err: null,
			values: {},
			isOpen: false
		};
	},
	
	getInitialState: function() {
		
		var values = this.props.values;
		
		_.each(this.props.list.fields, function(field) {
			if (!values[field.path]) {
				values[field.path] = field.defaultValue;
			}
		});
		
		return {
			values: values
		};
		
	},
	
	handleChange: function(event) {
		var values = this.state.values;
		values[event.path] = event.value;
		this.setState({
			values: values
		});
	},

	componentDidUpdate: function(prevProps, prevState) {
		let bodyStyle = document.body.style;
		
		if (this.refs.focusTarget) {
			this.refs.focusTarget.focus();
		}
		
		if (this.props.isOpen) {
			bodyStyle.overflow = 'hidden';
		} else {
			bodyStyle.overflow = '';
		}
	},
	
	componentDidMount: function() {
		if (this.refs.focusTarget) {
			this.refs.focusTarget.focus();
		}
	},
	
	getFieldProps: function(field) {
		var props = _.clone(field);
		props.value = this.state.values[field.path];
		props.values = this.state.values;
		props.onChange = this.handleChange;
		props.mode = 'create';
		return props;
	},
	
	render: function() {
		
		var alert = null;
		var form = {};
		var list = this.props.list;
		var formAction = '/keystone/' + list.path;
		var nameField = this.props.list.nameField;
		var focusRef;
		
		if (this.props.err && this.props.err.errors) {
			var alertContent;
			var errorCount = Object.keys(this.props.err.errors).length;
			var msgs = {};

			_.each(this.props.err.errors, function(err, path) {
				msgs[path] = errorCount > 1 ? <li>{err.message}</li> : <div>{err.message}</div>;
			});

			if (errorCount > 1) {
				alertContent = <div>
					<h4>There were {errorCount} errors creating the new {list.singular}:</h4>
					<ul>{msgs}</ul>
				</div>
			} else {
				alertContent = {msgs}
			}
			alert = <Alert type="danger">{alertContent}</Alert>;
		}
		
		if (list.nameIsInitial) {
			var nameFieldProps = this.getFieldProps(nameField);
			nameFieldProps.ref = focusRef = 'focusTarget';
			if (nameField.type === 'text') {
				nameFieldProps.className = 'item-name-field';
				nameFieldProps.placeholder = nameField.label;
				nameFieldProps.label = false;
			}
			form[nameField.path] = React.createElement(Fields[nameField.type], nameFieldProps);
		}
		
		_.each(list.initialFields, function(path) {
				
			var field = list.fields[path];
			
			if ('function' !== typeof Fields[field.type]) {
				form[field.path] = React.createElement(InvalidFieldType, { type: field.type, path: field.path });
				return;
			}
			
			var fieldProps = this.getFieldProps(field);
			
			if (!focusRef) {
				fieldProps.ref = focusRef = 'focusTarget';
			}
			
			form[field.path] = React.createElement(Fields[field.type], fieldProps);
			
		}, this);
		
		return (
			<Modal isOpen={this.props.isOpen} onCancel={this.props.onCancel} backdropClosesModal>
				<form encType="multipart/form-data" method="post" action={formAction} className="horizontal-form create-form">
					<input type="hidden" name="action" value="create" />
					<input type="hidden" name={Keystone.csrf.key} value={Keystone.csrf.value} />
					<Modal.Header text={'Create a new ' + list.singular} onClose={this.props.onCancel} showCloseButton />
					<Modal.Body>
						{alert}
						{form}
					</Modal.Body>
					<Modal.Footer>
						<Button type="success" submit>Create</Button>
						<Button type="link-cancel" onClick={this.props.onCancel}>cancel</Button>
					</Modal.Footer>
				</form>
			</Modal>
		);
	}
	
});

module.exports = Form;
